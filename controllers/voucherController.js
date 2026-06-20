import connectDB from "../config/db.js";

/**
 * Get all vouchers for current branch
 */
export const getVouchersController = async (req, res) => {
  try {
    const pool = await connectDB();
    const branch_id = req.user.branch_id;

    const [rows] = await pool.execute(
      `SELECT v.id, v.item_id, v.item_name, v.quantity, v.remaining_quantity, v.status,
              u.unit_symbol AS unit,
              DATE_FORMAT(v.created_at, '%d-%m-%Y %h:%i %p') AS created_at,
              DATE_FORMAT(v.received_at, '%d-%m-%Y %h:%i %p') AS received_at
       FROM vouchers v
       LEFT JOIN items i ON v.item_id = i.id
       LEFT JOIN units u ON i.item_unit_id = u.id
       WHERE v.branch_id = ?
       ORDER BY v.id DESC`,
      [branch_id]
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("❌ Fetch Vouchers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vouchers",
      error: error.message
    });
  }
};

/**
 * Update voucher status (e.g. from Pending to Received)
 */
export const updateVoucherStatusController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    const branch_id = req.user.branch_id;
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        message: "Voucher ID and status are required"
      });
    }

    await conn.beginTransaction();

    // 1. Fetch current status, item_id, and quantity of the voucher
    const [voucherRows] = await conn.execute(
      `SELECT item_id, quantity, status FROM vouchers WHERE id = ? AND branch_id = ? FOR UPDATE`,
      [id, branch_id]
    );

    if (voucherRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: "Voucher not found or access denied"
      });
    }

    const voucher = voucherRows[0];
    const currentStatus = voucher.status;

    // 2. Update status and received_at time in vouchers
    let query = `UPDATE vouchers SET status = ?`;
    const params = [status];

    if (status === "Received") {
      query += `, received_at = NOW()`;
    } else {
      query += `, received_at = NULL`;
    }

    query += ` WHERE id = ? AND branch_id = ?`;
    params.push(id, branch_id);

    await conn.execute(query, params);

    // 3. Handle items stock adjustments based on status transitions
    if (voucher.item_id) {
      const qty = Number(voucher.quantity || 0);

      if (currentStatus !== "Received" && status === "Received") {
        // Transition: Not Received -> Received => Add stock
        await conn.execute(
          `UPDATE items 
           SET original_qty = original_qty + ?, 
               remaining_qty = remaining_qty + ?,
               stock_status = CASE WHEN remaining_qty + ? > 0 AND stock_status = 'Out of Stock' THEN 'In Stock' ELSE stock_status END
           WHERE id = ?`,
          [qty, qty, qty, voucher.item_id]
        );
      } else if (currentStatus === "Received" && status !== "Received") {
        // Transition: Received -> Not Received => Deduct stock (revert)
        await conn.execute(
          `UPDATE items 
           SET original_qty = GREATEST(0, original_qty - ?), 
               remaining_qty = remaining_qty - ?,
               stock_status = CASE WHEN remaining_qty - ? <= 0 AND stock_status != 'Do Not Track' THEN 'Out of Stock' ELSE stock_status END
           WHERE id = ?`,
          [qty, qty, qty, voucher.item_id]
        );
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: `Voucher status updated to ${status} successfully`
    });
  } catch (error) {
    await conn.rollback();
    console.error("❌ Update Voucher Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update voucher status",
      error: error.message
    });
  } finally {
    conn.release();
  }
};

/**
 * Bulk import vouchers from Excel/CSV
 */
export const importVouchersController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const branch_id = req.user.branch_id;
    const { vouchers } = req.body; // Array of { item_name, quantity, status }

    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vouchers data array is required"
      });
    }

    for (const v of vouchers) {
      const itemName = v.item_name;
      const qty = Number(v.quantity);
      const status = v.status || "Received"; // Default imported to Received so they can sell immediately

      if (!itemName || isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid item name '${itemName}' or quantity '${v.quantity}' in import data`);
      }

      // Try to find the item_id by name
      const [[itemRow]] = await conn.execute(
        `SELECT id FROM items WHERE name = ? AND branch_id = ? AND is_active = 1`,
        [itemName, branch_id]
      );
      const item_id = itemRow ? itemRow.id : null;

      // Generate random unique 6-digit ID
      let isUnique = false;
      let randomVoucherId;
      while (!isUnique) {
        randomVoucherId = Math.floor(100000 + Math.random() * 900000);
        const [[row]] = await conn.execute("SELECT id FROM vouchers WHERE id = ?", [randomVoucherId]);
        if (!row) isUnique = true;
      }

      // Insert voucher
      await conn.execute(
        `INSERT INTO vouchers (id, branch_id, item_id, item_name, quantity, remaining_quantity, status, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomVoucherId,
          branch_id,
          item_id,
          itemName,
          qty,
          qty, // remaining_quantity equals original quantity initially
          status,
          status === "Received" ? new Date() : null
        ]
      );

      // If status is Received, update the item's original_qty and remaining_qty
      if (status === "Received" && item_id) {
        await conn.execute(
          `UPDATE items 
           SET original_qty = original_qty + ?, 
               remaining_qty = remaining_qty + ?,
               stock_status = CASE WHEN remaining_qty + ? > 0 AND stock_status = 'Out of Stock' THEN 'In Stock' ELSE stock_status END
           WHERE id = ?`,
          [qty, qty, qty, item_id]
        );
      }
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `Successfully imported ${vouchers.length} vouchers`
    });
  } catch (error) {
    await conn.rollback();
    console.error("❌ Bulk Import Vouchers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import vouchers",
      error: error.message
    });
  } finally {
    conn.release();
  }
};

/**
 * Manually create a single voucher
 */
export const createVoucherController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const branch_id = req.user.branch_id;
    const { item_name, quantity, status } = req.body;

    if (!item_name || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Item name and quantity are required"
      });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number"
      });
    }

    // Try to find the item_id by name
    const [[itemRow]] = await conn.execute(
      `SELECT id FROM items WHERE name = ? AND branch_id = ? AND is_active = 1`,
      [item_name, branch_id]
    );
    const item_id = itemRow ? itemRow.id : null;

    // Generate random unique 6-digit ID
    let isUnique = false;
    let randomVoucherId;
    while (!isUnique) {
      randomVoucherId = Math.floor(100000 + Math.random() * 900000);
      const [[row]] = await conn.execute("SELECT id FROM vouchers WHERE id = ?", [randomVoucherId]);
      if (!row) isUnique = true;
    }

    const voucherStatus = status || "Pending";

    await conn.execute(
      `INSERT INTO vouchers (id, branch_id, item_id, item_name, quantity, remaining_quantity, status, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomVoucherId,
        branch_id,
        item_id,
        item_name,
        qty,
        qty,
        voucherStatus,
        voucherStatus === "Received" ? new Date() : null
      ]
    );

    // If status is Received, update the item's original_qty and remaining_qty
    if (voucherStatus === "Received" && item_id) {
      await conn.execute(
        `UPDATE items 
         SET original_qty = original_qty + ?, 
             remaining_qty = remaining_qty + ?,
             stock_status = CASE WHEN remaining_qty + ? > 0 AND stock_status = 'Out of Stock' THEN 'In Stock' ELSE stock_status END
         WHERE id = ?`,
        [qty, qty, qty, item_id]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Voucher created manually successfully",
      voucher_id: randomVoucherId
    });
  } catch (error) {
    await conn.rollback();
    console.error("❌ Create Voucher Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create voucher",
      error: error.message
    });
  } finally {
    conn.release();
  }
};
