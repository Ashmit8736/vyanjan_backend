import connectDB from "../config/db.js";

export const createSalesInvoiceController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { id, client_name, subtotal, gst, total, items } = req.body;

    if (!id || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID and items are required"
      });
    }

    // 1. Insert Sales Invoice
    await conn.execute(
      `INSERT INTO sales_invoices (id, branch_id, client_name, subtotal, gst, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, branch_id, client_name || null, subtotal, gst, total]
    );

    // 2. Insert Invoice Items and Perform Auto-Consumption
    for (const item of items) {
      // Insert item
      await conn.execute(
        `INSERT INTO sales_invoice_items (invoice_id, item_name, quantity, price)
         VALUES (?, ?, ?, ?)`,
         [id, item.name, item.qty, item.price]
      );

      // Check if finished item exists and get its ID
      const [[dbItem]] = await conn.execute(
        `SELECT id FROM items WHERE name = ? AND branch_id = ? AND is_active = 1`,
        [item.name, branch_id]
      );

      if (dbItem) {
        // Find active recipe for this item
        const [[recipe]] = await conn.execute(
          `SELECT id, item_quantity FROM recipes WHERE item_id = ? AND branch_id = ? AND is_active = 1`,
          [dbItem.id, branch_id]
        );

        if (recipe) {
          // Get recipe ingredients
          const [materials] = await conn.execute(
            `SELECT raw_material_id, quantity FROM recipe_materials WHERE recipe_id = ?`,
            [recipe.id]
          );

          // Calculate factor: how many recipe portions did we sell?
          // e.g., if recipe produces 1 Samosa (item_quantity = 1), and we sold 10, factor is 10/1 = 10.
          const portionFactor = Number(item.qty) / Number(recipe.item_quantity || 1);

          for (const mat of materials) {
            const consumedQty = Number(mat.quantity) * portionFactor;

            // Check if stock entry exists
            const [[stock]] = await conn.execute(
              `SELECT id FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?`,
              [mat.raw_material_id, branch_id]
            );

            if (stock) {
              // Deduct stock (it can go negative)
              await conn.execute(
                `UPDATE raw_material_stock
                 SET quantity = quantity - ?, last_updated_at = NOW()
                 WHERE raw_material_id = ? AND branch_id = ?`,
                [consumedQty, mat.raw_material_id, branch_id]
              );
            } else {
              // Create stock entry with negative quantity
              await conn.execute(
                `INSERT INTO raw_material_stock (raw_material_id, branch_id, quantity, last_updated_at)
                 VALUES (?, ?, ?, NOW())`,
                [mat.raw_material_id, branch_id, -consumedQty]
              );
            }
          }
        }
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "POS Invoice created and raw material stock consumed successfully"
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
    const branch_id = req.user.branch_id;

    const [rows] = await pool.execute(
      `SELECT id, client_name AS client, DATE_FORMAT(created_at, '%d-%m-%Y') AS date, total AS amount, status
       FROM sales_invoices
       WHERE branch_id = ?
       ORDER BY created_at DESC`,
      [branch_id]
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
    const branch_id = req.user.branch_id;

    // 1. Total Revenue
    const [[{ total_revenue }]] = await pool.execute(
      `SELECT COALESCE(SUM(total), 0) AS total_revenue 
       FROM sales_invoices 
       WHERE branch_id = ? AND status = 'Paid'`,
      [branch_id]
    );

    // 2. Total Invoices Count
    const [[{ total_invoices }]] = await pool.execute(
      `SELECT COUNT(*) AS total_invoices 
       FROM sales_invoices 
       WHERE branch_id = ?`,
      [branch_id]
    );

    // 3. Pending Payments
    const [[{ pending_payments }]] = await pool.execute(
      `SELECT COALESCE(SUM(total), 0) AS pending_payments 
       FROM sales_invoices 
       WHERE branch_id = ? AND (status = 'Pending' OR status = 'Unpaid')`,
      [branch_id]
    );

    // 4. Paid This Month
    const [[{ paid_this_month }]] = await pool.execute(
      `SELECT COALESCE(SUM(total), 0) AS paid_this_month 
       FROM sales_invoices 
       WHERE branch_id = ? AND status = 'Paid' 
         AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
         AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
      [branch_id]
    );

    // 5. Recent Invoices (Latest 5)
    const [recent_invoices] = await pool.execute(
      `SELECT id, client_name AS client, total AS amount, status 
       FROM sales_invoices
       WHERE branch_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [branch_id]
    );

    res.status(200).json({
      success: true,
      data: {
        total_revenue: Number(total_revenue),
        total_invoices: Number(total_invoices),
        pending_payments: Number(pending_payments),
        paid_this_month: Number(paid_this_month),
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
