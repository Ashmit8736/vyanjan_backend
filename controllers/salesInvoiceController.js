import connectDB from "../config/db.js";

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
      total
    } = req.body;

    const invoiceNumber = invoice_number || await generateInvoiceNumber();
    const tokenNumber = token_number || await generateTokenNumber();
    const invoiceTotal = total_amount ?? total;
    const kotNumber = kot_number || tokenNumber || invoiceNumber || "NA";

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

    const [invoiceResult] = await conn.execute(
      `INSERT INTO invoices (invoice_number, token_number, kot_number, total_amount)
       VALUES (?, ?, ?, ?)`,
      [invoiceNumber, tokenNumber, kotNumber, invoiceTotal ?? 0]
    );

    const invoiceId = invoiceResult.insertId;

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

    await conn.commit();

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
      `SELECT id, invoice_number, token_number, kot_number, client_name,
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
