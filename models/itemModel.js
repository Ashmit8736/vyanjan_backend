import connectDB from "../config/db.js";

/**
 * Create Item
 */
export const createItem = async (branch_id, name, category, selling_price) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `INSERT INTO items (branch_id, name, category, selling_price)
     VALUES (?, ?, ?, ?)`,
    [branch_id, name, category, selling_price]
  );

  return result.insertId;
};

/**
 * Get items by branch
 */
export const getItemsByBranch = async (branch_id) => {
  const conn = await connectDB();

  const [rows] = await conn.execute(
    `SELECT *
     FROM items
     WHERE branch_id = ? AND is_active = 1
     ORDER BY id DESC`,
    [branch_id]
  );

  return rows;
};
