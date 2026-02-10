import connectDB from "../config/db.js";


export const createProduction = async ({
    branch_id,
    item_id,
    recipe_id,
    produce_quantity,
    produce_unit_id,
    created_by
}) => {
    const conn = await connectDB();

    try {
        await conn.beginTransaction();

        /* 1️⃣ Get recipe output */
        const [[recipe]] = await conn.execute(
            `SELECT item_quantity
       FROM recipes
       WHERE id = ? AND is_active = 1`,
            [recipe_id]
        );

        if (!recipe) {
            throw new Error("Recipe not found");
        }

        /* 2️⃣ Calculate recipe count */
        // const recipeCount = produce_quantity / recipe.item_quantity;
        const recipeCount = produce_quantity;


        /* 3️⃣ Get recipe materials */
        const [materials] = await conn.execute(
            `SELECT raw_material_id, quantity, consume_unit_id
       FROM recipe_materials
       WHERE recipe_id = ?`,
            [recipe_id]
        );

        if (materials.length === 0) {
            throw new Error("No recipe materials found");
        }

        /* 4️⃣ Stock check */
        for (const m of materials) {
            const requiredQty = m.quantity * recipeCount;

            const [[stock]] = await conn.execute(
                `
  SELECT 
    COALESCE(rms.quantity, 0) AS quantity,
    rm.name AS raw_material_name,
    u.unit_name,
    u.unit_symbol
  FROM raw_materials rm
  LEFT JOIN raw_material_stock rms
    ON rms.raw_material_id = rm.id
   AND rms.branch_id = ?
  LEFT JOIN units u
    ON u.id = ?
  WHERE rm.id = ?
  `,
                [
                    branch_id,
                    m.consume_unit_id,   // unit from recipe_materials
                    m.raw_material_id
                ]
            );

            if (!stock || stock.quantity < requiredQty) {

                const materialName = stock?.raw_material_name || "raw material";
                const unit = stock?.unit_symbol || "";
                const availableQty = stock?.quantity ?? 0;

                throw new Error(
                    `Insufficient stock for ${materialName}. ` +
                    `Required: ${requiredQty} ${unit}, ` +
                    `Available: ${availableQty} ${unit}`
                );
            }

        }

        /* 5️⃣ Insert production */
        const [prodResult] = await conn.execute(
            `INSERT INTO production
       (branch_id, item_id, recipe_id, produce_quantity, produce_unit_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                branch_id,
                item_id,
                recipe_id,
                produce_quantity,
                produce_unit_id,
                created_by
            ]
        );

        const production_id = prodResult.insertId;

        /* 6️⃣ Deduct stock + insert production_materials */
        for (const m of materials) {
            const requiredQty = m.quantity * recipeCount;

            await conn.execute(
                `UPDATE raw_material_stock
         SET quantity = quantity - ?, last_updated_at = NOW()
         WHERE raw_material_id = ? AND branch_id = ?`,
                [requiredQty, m.raw_material_id, branch_id]
            );

            await conn.execute(
                `INSERT INTO production_materials
         (production_id, recipe_id, raw_material_id, quantity, unit_id)
         VALUES (?, ?, ?, ?, ?)`,
                [
                    production_id,
                    recipe_id,
                    m.raw_material_id,
                    requiredQty,
                    m.consume_unit_id
                ]
            );
        }

        await conn.commit();
        return production_id;

    } catch (error) {
        await conn.rollback();
        throw error;
    }
};


/**
 * Get Production List by Branch
 */
export const getProductionByBranch = async (branch_id) => {
    const conn = await connectDB();

    const [rows] = await conn.execute(
        `SELECT
        p.id,
        p.produce_quantity,
        p.status,
        p.produced_at,

        i.name AS item_name,

        u.unit_name,
        u.unit_symbol

     FROM production p

     JOIN items i
       ON i.id = p.item_id

     LEFT JOIN units u
       ON u.id = p.produce_unit_id

     WHERE p.branch_id = ?

     ORDER BY p.id DESC`,
        [branch_id]
    );

    return rows;
};
