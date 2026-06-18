import connectDB from "../config/db.js";
import {
  createStockPurchaseItems,
  updateRawMaterialStockPurchase,
  getStockByBranch,
  // getStockReportByPOId,
   getStockPurchaseList,
   getStockReportByPONumber
} from "../models/stockPurchaseItemModel.js";

export const createStockPurchaseItemsController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { purchase_order_id, invoice_number, invoice_date, payment_status, items } = req.body;

    // Update the purchase order status to completed and persist invoice details and payment status
    await conn.execute(
      `UPDATE purchase_orders
       SET status = 'completed',
           payment_status = ?,
           invoice_number = ?,
           purchase_date = ?
       WHERE id = ?`,
      [
        payment_status || 'pending',
        invoice_number || null,
        invoice_date || null,
        purchase_order_id
      ]
    );


for (const item of items) {

  const [[rm]] = await conn.query(
    `SELECT purchase_unit_id, conversion_factor
     FROM raw_materials
     WHERE id = ?`,
    [item.raw_material_id]
  );

  if (Number(item.unit_id) !== Number(rm.purchase_unit_id)) {
    throw new Error("Purchase stock must be added in PURCHASE UNIT only");
  }

  // ✅ CONVERT purchase → consume
  const convertedQuantity =
    item.quantity * rm.conversion_factor;

  // ✅ always store consume unit
  await updateRawMaterialStockPurchase(
    item.raw_material_id,
    branch_id,
    convertedQuantity,
    conn
  );

  const amount = item.quantity * item.unit_price;
const itemDiscount = item.item_discount || 0;

// GST calculation
let cgstAmount = 0;
let sgstAmount = 0;
let igstAmount = 0;

if (item.igst_percent && item.igst_percent > 0) {
  // Inter-state
  igstAmount = amount * (item.igst_percent / 100);
} else {
  // Intra-state
  cgstAmount = amount * ((item.cgst_percent || 0) / 100);
  sgstAmount = amount * ((item.sgst_percent || 0) / 100);
}

const totalTax = cgstAmount + sgstAmount + igstAmount;

// ✅ Final amount
const finalAmount = amount + totalTax - itemDiscount;


  await conn.query(
  `INSERT INTO stock_purchase_items
   (
     purchase_order_id,
     raw_material_id,
     branch_id,
     quantity,
     unit_id,
     unit_price,
     amount,
     cgst_percent,
     sgst_percent,
     igst_percent,
     cgst_amount,
     sgst_amount,
     igst_amount,
     item_discount,
     final_amount
   )
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [
    purchase_order_id,
    item.raw_material_id,
    branch_id,
    item.quantity,
    item.unit_id,
    item.unit_price,
    amount,
    item.cgst_percent || 0,
    item.sgst_percent || 0,
    item.igst_percent || 0,
    cgstAmount,
    sgstAmount,
    igstAmount,
    itemDiscount,
    finalAmount
  ]
);


}


    await conn.commit();

    res.json({
      success: true,
      message: "Purchase stock added correctly (purchase unit)"
    });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};


/**
 * GET STOCK (DISPLAY)
 */
export const getStockController = async (req, res) => {
  const data = await getStockByBranch(req.user.branch_id);
  res.json({ success: true, data });
};




/* ===== GET STOCK PURCHASE LIST ===== */
export const stockPurchaseList = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required"
      });
    }

    const data = await getStockPurchaseList(branchId);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ Stock Purchase List Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


export const getStockReport = async (req, res) => {
  try {
    const { poNumber } = req.params;
    const branchId = req.user.branch_id;


    const data = await getStockReportByPONumber(poNumber, branchId);

    if (!data.header) {
      return res.status(404).json({
        message: "No stock purchase entries found for this PO",
      });
    }

    res.json({
      success: true,
      header: data.header,
      items: data.items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ===== CANCEL STOCK PURCHASE (REVERT STOCK) ===== */
export const cancelStockPurchaseController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { poId } = req.params;
    const branch_id = req.user.branch_id;

    // Check if PO exists and is completed
    const [[po]] = await conn.query(
      `SELECT id, status FROM purchase_orders WHERE id = ? AND branch_id = ?`,
      [poId, branch_id]
    );

    if (!po) {
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }

    if (po.status === 'cancelled') {
      return res.status(400).json({ success: false, message: "Purchase order is already cancelled" });
    }

    // Revert stock if it was completed
    if (po.status === 'completed') {
      const [items] = await conn.query(
        `SELECT raw_material_id, quantity FROM stock_purchase_items WHERE purchase_order_id = ?`,
        [poId]
      );

      for (const item of items) {
        const [[rm]] = await conn.query(
          `SELECT conversion_factor FROM raw_materials WHERE id = ?`,
          [item.raw_material_id]
        );

        const convertedQuantity = item.quantity * rm.conversion_factor;

        await conn.query(
          `UPDATE raw_material_stock
           SET quantity = quantity - ?, last_updated_at = NOW()
           WHERE raw_material_id = ? AND branch_id = ?`,
          [convertedQuantity, item.raw_material_id, branch_id]
        );
      }
    }

    // Update PO status to cancelled
    await conn.execute(
      `UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?`,
      [poId]
    );

    await conn.commit();
    res.json({ success: true, message: "Purchase order cancelled and stock reverted successfully" });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ===== UPDATE PAYMENT STATUS ===== */
export const updatePaymentStatusController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();
  try {
    const { poId } = req.params;
    const { payment_status } = req.body;
    const branch_id = req.user.branch_id;

    await conn.execute(
      `UPDATE purchase_orders SET payment_status = ? WHERE id = ? AND branch_id = ?`,
      [payment_status, poId, branch_id]
    );

    res.json({ success: true, message: `Payment status updated to ${payment_status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ===== EDIT STOCK PURCHASE ITEMS & UPDATE STOCK ===== */
export const editStockPurchaseItemsController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { poId } = req.params;
    const { invoice_number, invoice_date, payment_status, items } = req.body;

    // 1. Fetch old stock purchase items to revert stock
    const [oldItems] = await conn.query(
      `SELECT raw_material_id, quantity FROM stock_purchase_items WHERE purchase_order_id = ?`,
      [poId]
    );

    for (const item of oldItems) {
      const [[rm]] = await conn.query(
        `SELECT conversion_factor FROM raw_materials WHERE id = ?`,
        [item.raw_material_id]
      );
      const convertedQuantity = item.quantity * rm.conversion_factor;

      await conn.query(
        `UPDATE raw_material_stock
         SET quantity = quantity - ?, last_updated_at = NOW()
         WHERE raw_material_id = ? AND branch_id = ?`,
        [convertedQuantity, item.raw_material_id, branch_id]
      );
    }

    // 2. Delete old stock purchase items
    await conn.query(
      `DELETE FROM stock_purchase_items WHERE purchase_order_id = ?`,
      [poId]
    );

    // 3. Compute totals and update PO details
    let subTotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (const item of items) {
      const amount = item.quantity * item.unit_price;
      subTotal += amount;

      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      if (item.igst_percent && item.igst_percent > 0) {
        igstAmount = amount * (item.igst_percent / 100);
      } else {
        cgstAmount = amount * ((item.cgst_percent || 0) / 100);
        sgstAmount = amount * ((item.sgst_percent || 0) / 100);
      }
      taxAmount += (cgstAmount + sgstAmount + igstAmount);
      discountAmount += Number(item.item_discount || 0);
    }

    const grandTotal = subTotal + taxAmount - discountAmount;

    await conn.execute(
      `UPDATE purchase_orders
       SET payment_status = ?,
           invoice_number = ?,
           purchase_date = ?,
           sub_total = ?,
           tax_amount = ?,
           discount_amount = ?,
           grand_total = ?,
           status = 'completed'
       WHERE id = ? AND branch_id = ?`,
      [
        payment_status || 'pending',
        invoice_number || null,
        invoice_date || null,
        subTotal,
        taxAmount,
        discountAmount,
        grandTotal,
        poId,
        branch_id
      ]
    );

    // 4. Save new stock purchase items and apply new stock
    for (const item of items) {
      const [[rm]] = await conn.query(
        `SELECT purchase_unit_id, conversion_factor FROM raw_materials WHERE id = ?`,
        [item.raw_material_id]
      );

      if (Number(item.unit_id) !== Number(rm.purchase_unit_id)) {
        throw new Error("Purchase stock must be added in PURCHASE UNIT only");
      }

      const convertedQuantity = item.quantity * rm.conversion_factor;

      await updateRawMaterialStockPurchase(
        item.raw_material_id,
        branch_id,
        convertedQuantity,
        conn
      );

      const amount = item.quantity * item.unit_price;
      const itemDiscount = item.item_discount || 0;

      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      if (item.igst_percent && item.igst_percent > 0) {
        igstAmount = amount * (item.igst_percent / 100);
      } else {
        cgstAmount = amount * ((item.cgst_percent || 0) / 100);
        sgstAmount = amount * ((item.sgst_percent || 0) / 100);
      }
      const totalTax = cgstAmount + sgstAmount + igstAmount;
      const finalAmount = amount + totalTax - itemDiscount;

      await conn.query(
        `INSERT INTO stock_purchase_items
         (
           purchase_order_id,
           raw_material_id,
           branch_id,
           quantity,
           unit_id,
           unit_price,
           amount,
           cgst_percent,
           sgst_percent,
           igst_percent,
           cgst_amount,
           sgst_amount,
           igst_amount,
           item_discount,
           final_amount
         )
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          poId,
          item.raw_material_id,
          branch_id,
          item.quantity,
          item.unit_id,
          item.unit_price,
          amount,
          item.cgst_percent || 0,
          item.sgst_percent || 0,
          item.igst_percent || 0,
          cgstAmount,
          sgstAmount,
          igstAmount,
          itemDiscount,
          finalAmount
        ]
      );
    }

    await conn.commit();
    res.json({ success: true, message: "Purchase stock edited successfully" });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ===== GET PAYMENTS ===== */
export const getPaymentsController = async (req, res) => {
  try {
    const conn = await connectDB();
    const { poId } = req.params;
    const branch_id = req.user.branch_id;

    const [payments] = await conn.query(
      `SELECT id, payment_date, paid_amount, payment_mode, payment_ref_no, status, created_by, created_at
       FROM purchase_order_payments
       WHERE purchase_order_id = ? AND branch_id = ? AND status = 'Active'
       ORDER BY id ASC`,
      [poId, branch_id]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ===== ADD PAYMENT ===== */
export const addPaymentController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { poId } = req.params;
    const { paid_amount, payment_date, payment_mode, payment_ref_no } = req.body;
    const branch_id = req.user.branch_id;
    const user_id = req.user.id;

    // Fetch user name
    const [[userRow]] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [user_id]
    );
    const creatorName = userRow?.name || "Ashish Mishra";

    // Fetch PO details
    const [[po]] = await conn.query(
      `SELECT grand_total FROM purchase_orders WHERE id = ? AND branch_id = ?`,
      [poId, branch_id]
    );

    if (!po) {
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }

    // Insert payment
    await conn.execute(
      `INSERT INTO purchase_order_payments 
       (purchase_order_id, branch_id, payment_date, paid_amount, payment_mode, payment_ref_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [poId, branch_id, payment_date || new Date(), paid_amount, payment_mode, payment_ref_no || null, creatorName]
    );

    // Calculate sum of active payments
    const [[sumRow]] = await conn.query(
      `SELECT COALESCE(SUM(paid_amount), 0) AS total_paid
       FROM purchase_order_payments
       WHERE purchase_order_id = ? AND branch_id = ? AND status = 'Active'`,
      [poId, branch_id]
    );

    const totalPaid = Number(sumRow.total_paid);
    const grandTotal = Number(po.grand_total);

    let newStatus = "pending";
    if (totalPaid >= grandTotal) {
      newStatus = "paid";
    } else if (totalPaid > 0) {
      newStatus = "partial";
    }

    // Update PO payment status
    await conn.execute(
      `UPDATE purchase_orders SET payment_status = ? WHERE id = ?`,
      [newStatus, poId]
    );

    await conn.commit();
    res.json({ success: true, message: "Payment added successfully", totalPaid, remaining: grandTotal - totalPaid });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ===== DELETE PAYMENT ===== */
export const deletePaymentController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { paymentId } = req.params;
    const branch_id = req.user.branch_id;

    // Get payment details
    const [[payment]] = await conn.query(
      `SELECT purchase_order_id, paid_amount FROM purchase_order_payments WHERE id = ? AND branch_id = ?`,
      [paymentId, branch_id]
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    const poId = payment.purchase_order_id;

    // Delete payment record
    await conn.execute(
      `DELETE FROM purchase_order_payments WHERE id = ?`,
      [paymentId]
    );

    // Fetch PO grand total
    const [[po]] = await conn.query(
      `SELECT grand_total FROM purchase_orders WHERE id = ? AND branch_id = ?`,
      [poId, branch_id]
    );

    // Recalculate sum of active payments
    const [[sumRow]] = await conn.query(
      `SELECT COALESCE(SUM(paid_amount), 0) AS total_paid
       FROM purchase_order_payments
       WHERE purchase_order_id = ? AND branch_id = ? AND status = 'Active'`,
      [poId, branch_id]
    );

    const totalPaid = Number(sumRow.total_paid);
    const grandTotal = Number(po.grand_total);

    let newStatus = "pending";
    if (totalPaid >= grandTotal) {
      newStatus = "paid";
    } else if (totalPaid > 0) {
      newStatus = "partial";
    }

    // Update PO payment status
    await conn.execute(
      `UPDATE purchase_orders SET payment_status = ? WHERE id = ?`,
      [newStatus, poId]
    );

    await conn.commit();
    res.json({ success: true, message: "Payment deleted successfully", totalPaid, remaining: grandTotal - totalPaid });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

/* ===== CREATE DIRECT STOCK PURCHASE (NO PO REQUIRED) ===== */
export const createDirectStockPurchaseController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const user_id = req.user.id;
    const { 
      supplier_id, 
      supplier_name, 
      invoice_number, 
      invoice_date, 
      payment_status, 
      items 
    } = req.body;

    if (!items || items.length === 0) {
      throw new Error("Purchase items are required");
    }

    // Fetch user name
    const [[userRow]] = await conn.query(
      `SELECT name FROM users WHERE id = ?`,
      [user_id]
    );
    const creatorName = userRow?.name || "Ashish Mishra";

    // 1. Handle Supplier (Manual entry support)
    let finalSupplierId = supplier_id;

    if (!finalSupplierId) {
      if (!supplier_name) {
        throw new Error("Either supplier_id or supplier_name must be provided");
      }
      
      // Check if a supplier with this name already exists in this branch
      const [[existingSupplier]] = await conn.query(
        `SELECT id FROM suppliers WHERE name = ? AND branch_id = ?`,
        [supplier_name, branch_id]
      );

      if (existingSupplier) {
        finalSupplierId = existingSupplier.id;
      } else {
        // Create new supplier on the fly
        const [supplierResult] = await conn.query(
          `INSERT INTO suppliers (branch_id, name, phone, is_active) VALUES (?, ?, ?, 1)`,
          [branch_id, supplier_name, "N/A"]
        );
        finalSupplierId = supplierResult.insertId;
      }
    }

    // 2. Generate unique PO number (e.g., DIR-YYYYMMDD-HHMMSS)
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14); 
    const poNumber = `DIR-${timestamp}`;

    // 3. Calculate Totals
    let subTotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (const item of items) {
      const amount = item.quantity * item.unit_price;
      subTotal += amount;

      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      if (item.igst_percent && item.igst_percent > 0) {
        igstAmount = amount * (item.igst_percent / 100);
      } else {
        cgstAmount = amount * ((item.cgst_percent || 0) / 100);
        sgstAmount = amount * ((item.sgst_percent || 0) / 100);
      }
      taxAmount += (cgstAmount + sgstAmount + igstAmount);
      discountAmount += Number(item.item_discount || 0);
    }

    const grandTotal = subTotal + taxAmount - discountAmount;

    // 4. Create Purchase Order
    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders
       (branch_id, supplier_id, po_number, invoice_number,
        purchase_date, sub_total, tax_amount, discount_amount, grand_total, payment_status, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        branch_id,
        finalSupplierId,
        poNumber,
        invoice_number || null,
        invoice_date || new Date(),
        subTotal,
        taxAmount,
        discountAmount,
        grandTotal,
        payment_status || "pending",
        "completed", // Auto complete since stock is received
        creatorName
      ]
    );

    const purchaseOrderId = poResult.insertId;

    // 5. Add Items and Update Stock
    for (const item of items) {
      const [[rm]] = await conn.query(
        `SELECT purchase_unit_id, conversion_factor FROM raw_materials WHERE id = ?`,
        [item.raw_material_id]
      );

      if (!rm) {
        throw new Error(`Raw material not found for ID: ${item.raw_material_id}`);
      }

      if (Number(item.unit_id) !== Number(rm.purchase_unit_id)) {
        throw new Error("Purchase stock must be added in PURCHASE UNIT only");
      }

      // Convert and update stock
      const convertedQuantity = item.quantity * rm.conversion_factor;
      
      const [[stock]] = await conn.query(
        `SELECT id FROM raw_material_stock
         WHERE raw_material_id = ? AND branch_id = ?`,
        [item.raw_material_id, branch_id]
      );
    
      if (stock) {
        await conn.query(
          `UPDATE raw_material_stock
           SET quantity = quantity + ?, last_updated_at = NOW()
           WHERE raw_material_id = ? AND branch_id = ?`,
          [convertedQuantity, item.raw_material_id, branch_id]
        );
      } else {
        await conn.query(
          `INSERT INTO raw_material_stock
           (raw_material_id, branch_id, quantity, last_updated_at)
           VALUES (?,?,?,NOW())`,
          [item.raw_material_id, branch_id, convertedQuantity]
        );
      }

      const amount = item.quantity * item.unit_price;
      const itemDiscount = item.item_discount || 0;

      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      if (item.igst_percent && item.igst_percent > 0) {
        igstAmount = amount * (item.igst_percent / 100);
      } else {
        cgstAmount = amount * ((item.cgst_percent || 0) / 100);
        sgstAmount = amount * ((item.sgst_percent || 0) / 100);
      }
      const totalTax = cgstAmount + sgstAmount + igstAmount;
      const finalAmount = amount + totalTax - itemDiscount;

      await conn.query(
        `INSERT INTO stock_purchase_items
         (
           purchase_order_id,
           raw_material_id,
           branch_id,
           quantity,
           unit_id,
           unit_price,
           amount,
           cgst_percent,
           sgst_percent,
           igst_percent,
           cgst_amount,
           sgst_amount,
           igst_amount,
           item_discount,
           final_amount
         )
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          purchaseOrderId,
          item.raw_material_id,
          branch_id,
          item.quantity,
          item.unit_id,
          item.unit_price,
          amount,
          item.cgst_percent || 0,
          item.sgst_percent || 0,
          item.igst_percent || 0,
          cgstAmount,
          sgstAmount,
          igstAmount,
          itemDiscount,
          finalAmount
        ]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Direct purchase recorded successfully",
      po_number: poNumber
    });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};
