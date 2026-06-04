import connectDB from "../config/db.js";

/**
 * Create Item
 */
export const createItem = async (branch_id, name, category, selling_price, item_unit_id) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `INSERT INTO items (branch_id, name, category, selling_price, item_unit_id)
     VALUES (?, ?, ?, ?, ?)`,
    [branch_id, name, category, selling_price, item_unit_id || null]
  );

  return result.insertId;
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
        i.created_at,
        i.item_unit_id,

        r.id            AS recipe_id,        -- ✅ REQUIRED
        r.item_quantity,
        r.item_unit_id  AS recipe_unit_id,   -- ✅ REQUIRED

        u.unit_name     AS item_unit_name,
        u.unit_symbol   AS item_unit_symbol,

        ru.unit_name    AS recipe_unit_name,
        ru.unit_symbol  AS recipe_unit_symbol

     FROM items i

     LEFT JOIN recipes r 
       ON r.item_id = i.id
       AND r.is_active = 1

     LEFT JOIN units u
       ON u.id = i.item_unit_id

     LEFT JOIN units ru
       ON ru.id = r.item_unit_id

     WHERE i.branch_id = ?
       AND i.is_active = 1

     ORDER BY i.id DESC`,
    [branch_id]
  );

  return rows;
};

export const updateItem = async (id, branch_id, name, category, selling_price, item_unit_id) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `UPDATE items 
     SET name = ?, category = ?, selling_price = ?, item_unit_id = ? 
     WHERE id = ? AND branch_id = ?`,
    [name, category, selling_price, item_unit_id || null, id, branch_id]
  );

  return result;
};

export const deleteItem = async (id, branch_id) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `UPDATE items SET is_active = 0 WHERE id = ? AND branch_id = ?`,
    [id, branch_id]
  );

  return result;
};

export const getItemLogs = async (id, branch_id) => {
  const conn = await connectDB();

  // 1. Get creation date
  const [[itemRow]] = await conn.execute(
    `SELECT created_at FROM items WHERE id = ? AND branch_id = ?`,
    [id, branch_id]
  );
  const itemCreatedAt = itemRow ? itemRow.created_at : null;

  // 2. Get active recipe creation date
  const [[recipeRow]] = await conn.execute(
    `SELECT created_at FROM recipes WHERE item_id = ? AND branch_id = ? AND is_active = 1`,
    [id, branch_id]
  );
  const recipeCreatedAt = recipeRow ? recipeRow.created_at : null;

  // 3. Get production runs
  const [productionRuns] = await conn.execute(
    `SELECT id, produce_quantity, status, DATE_FORMAT(created_at, '%d-%m-%Y %h:%i %p') AS date
     FROM production
     WHERE item_id = ? AND branch_id = ?
     ORDER BY created_at DESC`,
    [id, branch_id]
  );

  return {
    item_created_at: itemCreatedAt,
    recipe_created_at: recipeCreatedAt,
    production_runs: productionRuns
  };
};
