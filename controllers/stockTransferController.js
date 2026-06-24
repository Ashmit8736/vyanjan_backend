import connectDB from "../config/db.js";

export const dispatchStock = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const central_branch_id = req.user.branch_id;
    const { target_branch_id, items } = req.body;

    if (!target_branch_id || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Target branch and items are required" });
    }

    if (central_branch_id === target_branch_id) {
        return res.status(400).json({ success: false, message: "Cannot dispatch to the same branch" });
    }

    for (const item of items) {
      const { raw_material_id, quantity } = item; // quantity should be in consume units or standard unit used in stock

      // 1. Check central stock
      const [[centralStock]] = await conn.query(
        `SELECT id, quantity FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?`,
        [raw_material_id, central_branch_id]
      );

      if (!centralStock || centralStock.quantity < quantity) {
        throw new Error(`Insufficient stock for raw material ID: ${raw_material_id}`);
      }

      // 2. Deduct from central
      await conn.query(
        `UPDATE raw_material_stock SET quantity = quantity - ?, last_updated_at = NOW() WHERE id = ?`,
        [quantity, centralStock.id]
      );

      // 3. Add to target
      const [[targetStock]] = await conn.query(
        `SELECT id FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?`,
        [raw_material_id, target_branch_id]
      );

      if (targetStock) {
        await conn.query(
          `UPDATE raw_material_stock SET quantity = quantity + ?, last_updated_at = NOW() WHERE id = ?`,
          [quantity, targetStock.id]
        );
      } else {
        await conn.query(
          `INSERT INTO raw_material_stock (raw_material_id, branch_id, quantity, last_updated_at) VALUES (?, ?, ?, NOW())`,
          [raw_material_id, target_branch_id, quantity]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Stock dispatched successfully" });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};
