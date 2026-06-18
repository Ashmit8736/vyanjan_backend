import connectDB from "../config/db.js";

/**
 * Create recipe (header)
 */
export const createRecipe = async (
  item_id,
  branch_id,
  item_quantity,
  item_unit_id
) => {
  const conn = await connectDB();

  const [result] = await conn.execute(
    `INSERT INTO recipes 
     (item_id, branch_id, item_quantity, item_unit_id)
     VALUES (?, ?, ?, ?)`,
    [item_id, branch_id, item_quantity, item_unit_id]
  );

  return result.insertId;
};

/**
 * Add recipe materials
 */
export const addRecipeMaterials = async (recipe_id, materials) => {
  const conn = await connectDB();

  const values = materials.map((m) => [
    recipe_id,
    m.raw_material_id,
    m.quantity,
    m.consume_unit_id,
  ]);

  await conn.query(
    `INSERT INTO recipe_materials
     (recipe_id, raw_material_id, quantity, consume_unit_id)
     VALUES ?`,
    [values]
  );
};

export const getRecipeByItem = async (item_id) => {
  const conn = await connectDB();

  const [rows] = await conn.execute(
    `SELECT 
        r.id AS recipe_id,
        r.created_at AS recipe_created_at,

        r.item_quantity,
        iu.unit_name   AS item_unit_name,
        iu.unit_symbol AS item_unit_symbol,

        rm.raw_material_id,
        raw.name AS raw_material_name,

        rm.quantity,
        cu.unit_name   AS consume_unit_name,
        cu.unit_symbol AS consume_unit_symbol

     FROM recipes r
     JOIN recipe_materials rm 
       ON r.id = rm.recipe_id

     JOIN raw_materials raw 
       ON raw.id = rm.raw_material_id

     JOIN units iu 
       ON iu.id = r.item_unit_id

     JOIN units cu 
       ON cu.id = rm.consume_unit_id

     WHERE r.item_id = ?
       AND r.is_active = 1`,
    [item_id]
  );

  return rows;
};


export const checkRawMaterialStock = async (materials, branch_id) => {
  const conn = await connectDB();

  for (const m of materials) {

    // 🔹 STEP 1: Raw material ka NAME and Units
    const [rawRows] = await conn.execute(
      `SELECT name, purchase_unit_id, consume_unit_id, conversion_factor 
       FROM raw_materials 
       WHERE id = ?`,
      [m.raw_material_id]
    );

    const rawName = rawRows.length
      ? rawRows[0].name
      : "Raw Material";

    const rmDetails = rawRows.length ? rawRows[0] : null;

    // 🔹 STEP 2: Stock check (branch-wise)
    const [stockRows] = await conn.execute(
      `SELECT quantity 
       FROM raw_material_stock
       WHERE raw_material_id = ?
         AND branch_id = ?`,
      [m.raw_material_id, branch_id]
    );

    // ❌ Stock row missing
    if (stockRows.length === 0) {
      return {
        ok: false,
        message: `Stock not found for ${rawName}`,
      };
    }

    let requiredQty = Number(m.quantity);
    if (rmDetails && Number(m.consume_unit_id) === Number(rmDetails.purchase_unit_id)) {
        requiredQty = requiredQty * Number(rmDetails.conversion_factor || 1);
    }

    const availableQty = Number(stockRows[0].quantity);

    // ❌ Insufficient stock
    if (availableQty < requiredQty) {
      return {
        ok: false,
        message: `Insufficient stock for ${rawName}`,
      };
    }
  }

  return { ok: true };
};
