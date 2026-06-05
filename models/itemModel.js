import connectDB from "../config/db.js";

/**
 * Create Item
 */
export const createItem = async (
  branch_id,
  name,
  category,
  selling_price,
  item_unit_id,
  short_code = null,
  stock_status = "In Stock",
  favorite = 0
) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `INSERT INTO items (branch_id, name, category, selling_price, item_unit_id, short_code, stock_status, favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      branch_id,
      name,
      category || null,
      selling_price || 0,
      item_unit_id || null,
      short_code || null, 
      stock_status || "In Stock",
      favorite ? 1 : 0
    ]
  );

  return result.insertId;
};

/**
 * Get items by branch
 */
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
        i.short_code,
        i.stock_status,
        i.favorite,

        r.id            AS recipe_id,
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

     ORDER BY i.favorite DESC, i.id DESC`,
    [branch_id]
  );

  return rows;
};

/**
 * Update Item
 */
export const updateItem = async (
  id,
  branch_id,
  name,
  category,
  selling_price,
  item_unit_id,
  short_code = null,
  stock_status = "In Stock",
  favorite = 0
) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `UPDATE items 
     SET name = ?, category = ?, selling_price = ?, item_unit_id = ?, short_code = ?, stock_status = ?, favorite = ?
     WHERE id = ? AND branch_id = ?`,
    [
      name,
      category || null,
      selling_price || 0,
      item_unit_id || null,
      short_code || null,
      stock_status || "In Stock",
      favorite ? 1 : 0,
      id,
      branch_id
    ]
  );

  return result.affectedRows;
};

/**
 * Delete Item (Soft Delete)
 */
export const deleteItem = async (id, branch_id) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `UPDATE items SET is_active = 0 WHERE id = ? AND branch_id = ?`,
    [id, branch_id]
  );

  return result;
};

/**
 * Get Item Audit Logs
 */
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

/**
 * Check for duplicate item name in the same branch (case-insensitive)
 * If excludeId is provided, excludes that ID (useful for item updates)
 */
export const checkDuplicateItem = async (name, branch_id, excludeId = null) => {
  const conn = await connectDB();
  if (excludeId) {
    const [rows] = await conn.execute(
      `SELECT id FROM items WHERE LOWER(name) = LOWER(?) AND branch_id = ? AND is_active = 1 AND id != ?`,
      [name, branch_id, excludeId]
    );
    return rows.length > 0;
  } else {
    const [rows] = await conn.execute(
      `SELECT id FROM items WHERE LOWER(name) = LOWER(?) AND branch_id = ? AND is_active = 1`,
      [name, branch_id]
    );
    return rows.length > 0;
  }
};

