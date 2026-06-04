import connectDB from "../config/db.js";

/**
 * Create Item
 */
export const createItem = async (
  branch_id,
  name,
  category,
  selling_price,
  short_code,
  stock_status,
  item_unit_id,
  favorite
) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `INSERT INTO items (branch_id, name, category, selling_price, short_code, stock_status, item_unit_id, favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [branch_id, name, category, selling_price, short_code, stock_status, item_unit_id, favorite]
  );

  return result.insertId;
};

export const updateItem = async (
  item_id,
  name,
  category,
  selling_price,
  short_code,
  stock_status,
  item_unit_id,
  favorite
) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `UPDATE items SET name = ?, category = ?, selling_price = ?, short_code = ?, stock_status = ?, item_unit_id = ?, favorite = ?
     WHERE id = ? AND is_active = 1`,
    [name, category, selling_price, short_code, stock_status, item_unit_id, favorite, item_id]
  );

  return result.affectedRows;
};

// export const getItemsByBranch = async (branch_id) => {
//   const conn = await connectDB();

//   const [rows] = await conn.execute(
//     `SELECT 
//         i.id,
//         i.name,
//         i.category,
//         i.selling_price,

//         r.item_quantity,
//         u.unit_name   AS item_unit_name,
//         u.unit_symbol AS item_unit_symbol

//      FROM items i

//      LEFT JOIN recipes r 
//        ON r.item_id = i.id
//        AND r.is_active = 1

//      LEFT JOIN units u
//        ON u.id = r.item_unit_id

//      WHERE i.branch_id = ?
//        AND i.is_active = 1

//      ORDER BY i.id DESC`,
//     [branch_id]
//   );

//   return rows;
// };


export const getItemsByBranch = async (branch_id) => {
  const conn = await connectDB();

  const [rows] = await conn.execute(
    `SELECT 
        i.id,
        i.name,
        i.category,
        i.selling_price,
        i.short_code,
        i.stock_status,
        i.item_unit_id,
        i.favorite,

        r.id            AS recipe_id,
        r.item_quantity,
        r.item_unit_id AS recipe_item_unit_id,

        u.unit_name     AS item_unit_name,
        u.unit_symbol   AS item_unit_symbol

     FROM items i

     LEFT JOIN recipes r 
       ON r.item_id = i.id
       AND r.is_active = 1

     LEFT JOIN units u
       ON u.id = COALESCE(i.item_unit_id, r.item_unit_id)

     WHERE i.branch_id = ?
       AND i.is_active = 1

     ORDER BY i.favorite DESC, i.id DESC`,
    [branch_id]
  );

  return rows;
};
