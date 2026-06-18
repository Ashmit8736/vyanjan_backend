import connectDB from "../config/db.js";
import { sendInvoiceNotification } from "../utils/notification.js";

export const createSalesInvoiceController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  const generateInvoiceNumber = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [rows] = await conn.execute(
        `SELECT id FROM invoices WHERE invoice_number = ? LIMIT 1`,
        [candidate]
      );
      if (!rows.length) return candidate;
    }
    throw new Error("Unable to generate unique invoice number");
  };

  const generateTokenNumber = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `TKN-${Math.floor(1000 + Math.random() * 9000)}`;
      const [rows] = await conn.execute(
        `SELECT id FROM invoices WHERE token_number = ? LIMIT 1`,
        [candidate]
      );
      if (!rows.length) return candidate;
    }
    throw new Error("Unable to generate unique token number");
  };

  try {
    await conn.beginTransaction();

    const branch_id = req.user?.branch_id || null;
    const {
      invoice_number,
      token_number,
      kot_number,
      total_amount,
      items,
      total,
      client_name,
      customer_mobile,
      customer_location,
      whatsapp_enabled,
      notification_method,
      payment_mode,
      subtotal,
      gst,
      cgst,
      sgst,
      table_id,
      table_number,
      status
    } = req.body;

    const invoiceNumber = invoice_number || await generateInvoiceNumber();
    const tokenNumber = token_number || await generateTokenNumber();
    const invoiceTotal = total_amount ?? total;
    const kotNumber = kot_number || tokenNumber || invoiceNumber || "NA";

    // 1. Resolve or Create Customer
    let customerId = 0;
    if (customer_mobile) {
      const [existingCust] = await conn.execute(
        `SELECT id FROM customers WHERE mobile_number = ? LIMIT 1`,
        [customer_mobile]
      );
      if (existingCust.length > 0) {
        customerId = existingCust[0].id;
        await conn.execute(
          `UPDATE customers SET customer_name = ?, address = ? WHERE id = ?`,
          [client_name || 'Walk-In Customer', customer_location || '', customerId]
        );
      } else {
        const [insertCust] = await conn.execute(
          `INSERT INTO customers (customer_name, mobile_number, address, whatsapp_enabled, customer_type)
           VALUES (?, ?, ?, ?, 'Regular')`,
          [client_name || 'Walk-In Customer', customer_mobile, customer_location || '', whatsapp_enabled !== undefined ? whatsapp_enabled : 1]
        );
        customerId = insertCust.insertId;
      }
    }

    if (!invoiceNumber || !tokenNumber || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "invoice_number, token_number and items are required"
      });
    }

    const [existingRows] = await conn.execute(
      `SELECT id, invoice_number, token_number FROM invoices WHERE invoice_number = ? OR token_number = ? LIMIT 1`,
      [invoiceNumber, tokenNumber]
    );

    if (existingRows.length > 0) {
      const existingInvoice = existingRows[0];
      const duplicateMessage = existingInvoice.invoice_number === invoiceNumber
        ? "Invoice number already exists"
        : "Token number already exists";

      return res.status(409).json({
        success: false,
        message: duplicateMessage
      });
    }

    const invoiceSubtotal = subtotal ?? (invoiceTotal ? (Number(invoiceTotal) / 1.18) : 0);
    const invoiceGst = gst ?? (invoiceTotal ? (Number(invoiceTotal) - Number(invoiceSubtotal)) : 0);
    const invoiceCgst = cgst ?? (invoiceGst / 2);
    const invoiceSgst = sgst ?? (invoiceGst / 2);
    const invoicePaymentMode = payment_mode || 'Cash';

    const invoiceStatus = status || 'paid';

    const [invoiceResult] = await conn.execute(
      `INSERT INTO invoices (invoice_number, token_number, kot_number, total_amount, customer_id, branch_id, table_id, table_number, subtotal, gst, cgst, sgst, payment_mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        tokenNumber,
        kotNumber,
        invoiceTotal ?? 0,
        customerId,
        branch_id,
        table_id || null,
        table_number || null,
        Number(invoiceSubtotal).toFixed(2),
        Number(invoiceGst).toFixed(2),
        Number(invoiceCgst).toFixed(2),
        Number(invoiceSgst).toFixed(2),
        invoicePaymentMode,
        invoiceStatus
      ]
    );

    const invoiceId = invoiceResult.insertId;

    if (table_id) {
      const targetTableStatus = invoiceStatus;
      await conn.execute(
        `UPDATE tables SET status = ?, updated_at = NOW() WHERE id = ?`,
        [targetTableStatus, table_id]
      );
    }

    for (const item of items) {
      const itemQty = Number(item.qty ?? item.quantity ?? 0);
      const itemPrice = Number(item.price ?? 0);
      const itemSubtotal = Number((itemQty * itemPrice).toFixed(2));
      let itemId = item.item_id || item.id || null;

      if (!itemId) {
        const [itemRows] = await conn.execute(
          `SELECT id FROM items WHERE name = ? AND is_active = 1 ${branch_id ? "AND branch_id = ?" : ""} LIMIT 1`,
          branch_id ? [item.name, branch_id] : [item.name]
        );

        if (!itemRows.length) {
          throw new Error(`Item not found: ${item.name}`);
        }

        itemId = itemRows[0].id;
      }

      await conn.execute(
        `INSERT INTO invoice_items (invoice_id, item_id, quantity, price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [invoiceId, itemId, itemQty, itemPrice, itemSubtotal]
      );

      // Deduct sold quantity from the items table remaining_qty
      await conn.execute(
        `UPDATE items 
         SET remaining_qty = remaining_qty - ?,
             stock_status = CASE WHEN remaining_qty - ? <= 0 AND stock_status != 'Do Not Track' THEN 'Out of Stock' ELSE stock_status END
         WHERE id = ?`,
        [itemQty, itemQty, itemId]
      );

      // 2.1 Deduct from Received vouchers of this item (FIFO)
      let quantityToDeduct = Number(item.qty);
      const [vouchersList] = await conn.execute(
        `SELECT id, remaining_quantity FROM vouchers
         WHERE branch_id = ? AND item_name = ? AND status = 'Received' AND remaining_quantity > 0
         ORDER BY received_at ASC, id ASC`,
        [branch_id, item.name]
      );

      for (const voucher of vouchersList) {
        if (quantityToDeduct <= 0) break;

        const remQty = Number(voucher.remaining_quantity);
        if (remQty >= quantityToDeduct) {
          await conn.execute(
            `UPDATE vouchers SET remaining_quantity = remaining_quantity - ? WHERE id = ?`,
            [quantityToDeduct, voucher.id]
          );
          quantityToDeduct = 0;
        } else {
          await conn.execute(
            `UPDATE vouchers SET remaining_quantity = 0 WHERE id = ?`,
            [voucher.id]
          );
          quantityToDeduct -= remQty;
        }
      }

      // Check if finished item exists and get its ID
      const [[dbItem]] = await conn.execute(
        `SELECT id FROM items WHERE id = ? AND is_active = 1 ${branch_id ? "AND branch_id = ?" : ""}`,
        branch_id ? [itemId, branch_id] : [itemId]
      );

      if (dbItem) {
        const recipeQuery = `SELECT id, item_quantity FROM recipes WHERE item_id = ? AND is_active = 1 ${branch_id ? "AND branch_id = ?" : ""}`;
        const recipeParams = branch_id ? [dbItem.id, branch_id] : [dbItem.id];
        const [[recipe]] = await conn.execute(recipeQuery, recipeParams);

        if (recipe) {
          const [materials] = await conn.execute(
            `SELECT raw_material_id, quantity FROM recipe_materials WHERE recipe_id = ?`,
            [recipe.id]
          );

          const portionFactor = Number(itemQty) / Number(recipe.item_quantity || 1);

          for (const mat of materials) {
            const consumedQty = Number(mat.quantity) * portionFactor;
            const stockQuery = `SELECT id FROM raw_material_stock WHERE raw_material_id = ? ${branch_id ? "AND branch_id = ?" : ""}`;
            const stockParams = branch_id ? [mat.raw_material_id, branch_id] : [mat.raw_material_id];
            const [[stock]] = await conn.execute(stockQuery, stockParams);

            if (stock) {
              const updateQuery = `UPDATE raw_material_stock
                 SET quantity = quantity - ?, last_updated_at = NOW()
                 WHERE raw_material_id = ? ${branch_id ? "AND branch_id = ?" : ""}`;
              const updateParams = branch_id ? [consumedQty, mat.raw_material_id, branch_id] : [consumedQty, mat.raw_material_id];
              await conn.execute(updateQuery, updateParams);
            } else {
              if (branch_id) {
                await conn.execute(
                  `INSERT INTO raw_material_stock (raw_material_id, branch_id, quantity, last_updated_at)
                   VALUES (?, ?, ?, NOW())`,
                  [mat.raw_material_id, branch_id, -consumedQty]
                );
              } else {
                await conn.execute(
                  `INSERT INTO raw_material_stock (raw_material_id, quantity, last_updated_at)
                   VALUES (?, ?, NOW())`,
                  [mat.raw_material_id, -consumedQty]
                );
              }
            }
          }
        }
      }
    }

    // Fetch branch name for dynamic branding before committing
    let resolvedBranchName = "Vyanjan";
    if (branch_id) {
      try {
        const [[branchRow]] = await conn.execute(
          `SELECT branch_name FROM branch WHERE branch_id = ? LIMIT 1`,
          [branch_id]
        );
        if (branchRow && branchRow.branch_name) {
          resolvedBranchName = branchRow.branch_name;
        }
      } catch (err) {
        console.error("Error fetching branch name for notification:", err);
      }
    }

    await conn.commit();

    // Trigger notification asynchronously in the background
    const notificationMethod = notification_method || (whatsapp_enabled ? "WhatsApp" : "None");
    if (notificationMethod !== "None" && customer_mobile) {
      sendInvoiceNotification({
        invoiceNumber,
        customerName: client_name || "Customer",
        customerMobile: customer_mobile,
        totalAmount: invoiceTotal ?? 0,
        notificationMethod,
        branchName: resolvedBranchName
      }).catch((err) => {
        console.error("Error sending invoice notification in background:", err);
      });
    }

    res.status(201).json({
      success: true,
      message: "Invoice created and raw material stock consumed successfully",
      data: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        token_number: tokenNumber,
        kot_number: kotNumber,
        total_amount: invoiceTotal ?? 0,
        client_name: req.body.client_name || null
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error("❌ Save Invoice Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create invoice",
      error: error.message
    });
  } finally {
    conn.release();
  }
};

export const getSalesInvoicesController = async (req, res) => {
  try {
    const pool = await connectDB();

    const [rows] = await pool.execute(
      `SELECT id, invoice_number, token_number, kot_number, ' ' AS client_name,
              total_amount AS amount,
              DATE_FORMAT(created_at, '%d-%m-%Y') AS date,
              COALESCE(status, 'Paid') AS status
       FROM invoices
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("❌ Fetch Invoices Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
      error: error.message
    });
  }
};

export const getSalesDashboardStatsController = async (req, res) => {
  try {
    const pool = await connectDB();

    const [[{ total_revenue }]] = await pool.execute(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue FROM invoices`
    );

    const [[{ total_invoices }]] = await pool.execute(
      `SELECT COUNT(*) AS total_invoices FROM invoices`
    );

    const [recent_invoices] = await pool.execute(
      `SELECT invoice_number, token_number, kot_number, total_amount AS amount
       FROM invoices
       ORDER BY created_at DESC
       LIMIT 5`
    );

    res.status(200).json({
      success: true,
      data: {
        total_revenue: Number(total_revenue),
        total_invoices: Number(total_invoices),
        recent_invoices
      }
    });
  } catch (error) {
    console.error("❌ Fetch Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message
    });
  }
};

export const getInvoiceDetailsController = async (req, res) => {
  const { invoiceNumber } = req.params;
  try {
    const pool = await connectDB();
    
    const [invoices] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.token_number, i.kot_number, i.total_amount, 
              i.subtotal, i.gst, i.cgst, i.sgst, i.payment_mode, i.created_at, i.customer_id,
              i.table_id, i.table_number,
              c.customer_name, c.mobile_number, c.address AS customer_location,
              b.branch_name, b.address AS branch_address, b.primary_no AS branch_phone, b.gst_no AS branch_gst
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN branch b ON i.branch_id = b.branch_id
       WHERE i.invoice_number = ? OR i.id = ? LIMIT 1`,
      [invoiceNumber, invoiceNumber]
    );

    if (!invoices.length) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    const invoice = invoices[0];

    const [items] = await pool.execute(
      `SELECT ii.quantity, ii.price, ii.subtotal, item.name, item.category
       FROM invoice_items ii
       JOIN items item ON ii.item_id = item.id
       WHERE ii.invoice_id = ?`,
      [invoice.id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...invoice,
        items
      }
    });
  } catch (error) {
    console.error("❌ Fetch Invoice Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice details",
      error: error.message
    });
  }
};

export const updateInvoiceStatusController = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "Invoice ID is required" });
  }
  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Fetch the invoice to see if it has a table_id
    const [invoices] = await conn.execute(
      `SELECT table_id FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1`,
      [id, id]
    );

    if (invoices.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoice = invoices[0];

    // Update invoice status
    await conn.execute(
      `UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ? OR invoice_number = ?`,
      [status, id, id]
    );

    // If invoice is linked to a table, update table status
    if (invoice.table_id) {
      const targetTableStatus = status;
      await conn.execute(
        `UPDATE tables SET status = ?, updated_at = NOW() WHERE id = ?`,
        [targetTableStatus, invoice.table_id]
      );
    }

    await conn.commit();
    res.status(200).json({ success: true, message: `Invoice status updated to ${status} successfully` });
  } catch (error) {
    await conn.rollback();
    console.error("Error updating invoice status:", error);
    res.status(500).json({ success: false, message: "Failed to update invoice status", error: error.message });
  } finally {
    conn.release();
  }
};

export const updateSalesInvoiceController = async (req, res) => {
  const { invoiceNumber } = req.params;
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user?.branch_id || null;
    const {
      total_amount,
      items,
      subtotal,
      gst,
      cgst,
      sgst,
      payment_mode,
      table_id,
      table_number,
      status,
      client_name,
      customer_mobile,
      customer_location
    } = req.body;

    const [invoices] = await conn.execute(
      `SELECT id, customer_id FROM invoices WHERE invoice_number = ? LIMIT 1`,
      [invoiceNumber]
    );

    if (invoices.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoiceId = invoices[0].id;
    let customerId = invoices[0].customer_id;

    if (customer_mobile) {
      const [existingCust] = await conn.execute(
        `SELECT id FROM customers WHERE mobile_number = ? LIMIT 1`,
        [customer_mobile]
      );
      if (existingCust.length > 0) {
        customerId = existingCust[0].id;
        await conn.execute(
          `UPDATE customers SET customer_name = ?, address = ? WHERE id = ?`,
          [client_name || 'Walk-In Customer', customer_location || '', customerId]
        );
      } else {
        const [insertCust] = await conn.execute(
          `INSERT INTO customers (customer_name, mobile_number, address, whatsapp_enabled, customer_type)
           VALUES (?, ?, ?, 1, 'Regular')`,
          [client_name || 'Walk-In Customer', customer_mobile, customer_location || '']
        );
        customerId = insertCust.insertId;
      }
    }

    // Fetch old items to restore remaining_qty
    const [oldItems] = await conn.execute(
      `SELECT item_id, quantity FROM invoice_items WHERE invoice_id = ?`,
      [invoiceId]
    );

    for (const oldItem of oldItems) {
      await conn.execute(
        `UPDATE items 
         SET remaining_qty = remaining_qty + ?,
             stock_status = CASE WHEN remaining_qty + ? > 0 AND stock_status = 'Out of Stock' THEN 'In Stock' ELSE stock_status END
         WHERE id = ?`,
        [Number(oldItem.quantity), Number(oldItem.quantity), oldItem.item_id]
      );
    }

    await conn.execute(
      `DELETE FROM invoice_items WHERE invoice_id = ?`,
      [invoiceId]
    );

    const invoiceTotal = total_amount;
    const invoiceSubtotal = subtotal ?? (invoiceTotal ? (Number(invoiceTotal) / 1.18) : 0);
    const invoiceGst = gst ?? (invoiceTotal ? (Number(invoiceTotal) - Number(invoiceSubtotal)) : 0);
    const invoiceCgst = cgst ?? (invoiceGst / 2);
    const invoiceSgst = sgst ?? (invoiceGst / 2);
    const invoicePaymentMode = payment_mode || 'Cash';
    const invoiceStatus = status || 'running';

    await conn.execute(
      `UPDATE invoices 
       SET total_amount = ?, customer_id = ?, table_id = ?, table_number = ?, 
           subtotal = ?, gst = ?, cgst = ?, sgst = ?, payment_mode = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        invoiceTotal ?? 0,
        customerId || null,
        table_id || null,
        table_number || null,
        Number(invoiceSubtotal).toFixed(2),
        Number(invoiceGst).toFixed(2),
        Number(invoiceCgst).toFixed(2),
        Number(invoiceSgst).toFixed(2),
        invoicePaymentMode,
        invoiceStatus,
        invoiceId
      ]
    );

    for (const item of items) {
      const itemQty = Number(item.qty ?? item.quantity ?? 0);
      const itemPrice = Number(item.price ?? 0);
      const itemSubtotal = Number((itemQty * itemPrice).toFixed(2));
      let itemId = item.item_id || item.id || null;

      if (!itemId) {
        const [itemRows] = await conn.execute(
          `SELECT id FROM items WHERE name = ? AND is_active = 1 ${branch_id ? "AND branch_id = ?" : ""} LIMIT 1`,
          branch_id ? [item.name, branch_id] : [item.name]
        );

        if (!itemRows.length) {
          throw new Error(`Item not found: ${item.name}`);
        }
        itemId = itemRows[0].id;
      }

      await conn.execute(
        `INSERT INTO invoice_items (invoice_id, item_id, quantity, price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [invoiceId, itemId, itemQty, itemPrice, itemSubtotal]
      );

      // Deduct sold quantity from the items table remaining_qty
      await conn.execute(
        `UPDATE items 
         SET remaining_qty = remaining_qty - ?,
             stock_status = CASE WHEN remaining_qty - ? <= 0 AND stock_status != 'Do Not Track' THEN 'Out of Stock' ELSE stock_status END
         WHERE id = ?`,
        [itemQty, itemQty, itemId]
      );
    }

    if (table_id) {
      const targetTableStatus = invoiceStatus;
      await conn.execute(
        `UPDATE tables SET status = ?, updated_at = NOW() WHERE id = ?`,
        [targetTableStatus, table_id]
      );
    }

    await conn.commit();
    res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        total_amount: invoiceTotal ?? 0
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error("❌ Update Invoice Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update invoice",
      error: error.message
    });
  } finally {
    conn.release();
  }
};
