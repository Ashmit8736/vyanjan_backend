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


export const getItemsByBranch = async (branch_id) => {
  const conn = await connectDB();

  const [rows] = await conn.execute(
    `SELECT 
        i.id,
        i.name,
        i.category,
        i.selling_price,

        r.item_quantity,
        u.unit_name   AS item_unit_name,
        u.unit_symbol AS item_unit_symbol

     FROM items i

     LEFT JOIN recipes r 
       ON r.item_id = i.id
       AND r.is_active = 1

     LEFT JOIN units u
       ON u.id = r.item_unit_id

     WHERE i.branch_id = ?
       AND i.is_active = 1

     ORDER BY i.id DESC`,
    [branch_id]
  );

  return rows;
};
