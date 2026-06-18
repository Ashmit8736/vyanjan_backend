import connectDB from "../config/db.js";


export const createProduction = async ({
    branch_id,
    item_id,
    recipe_id,
    produce_quantity,
    produce_unit_id,
    created_by
}) => {
    const pool = await connectDB();
    const conn = await pool.getConnection();

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
        const recipeCount = Number(produce_quantity) / Number(recipe.item_quantity || 1);


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
            let requiredQty = m.quantity * recipeCount;

            const [[rmDetails]] = await conn.execute(
                `SELECT purchase_unit_id, consume_unit_id, conversion_factor FROM raw_materials WHERE id = ?`,
                [m.raw_material_id]
            );

            if (rmDetails && Number(m.consume_unit_id) === Number(rmDetails.purchase_unit_id)) {
                requiredQty = requiredQty * Number(rmDetails.conversion_factor || 1);
            }
            
            // attach converted quantity to m for deduction step
            m.convertedRequiredQty = requiredQty;

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
    ON u.id = rm.consume_unit_id
  WHERE rm.id = ?
  `,
                [
                    branch_id,
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

        /* 5.1️⃣ Get item name and insert pending voucher with random 6-digit ID */
        const [[itemRow]] = await conn.execute(
            `SELECT name FROM items WHERE id = ?`,
            [item_id]
        );
        const itemName = itemRow ? itemRow.name : "Unknown Item";

        let isUnique = false;
        let randomVoucherId;
        while (!isUnique) {
          randomVoucherId = Math.floor(100000 + Math.random() * 900000);
          const [[row]] = await conn.execute("SELECT id FROM vouchers WHERE id = ?", [randomVoucherId]);
          if (!row) isUnique = true;
        }

        await conn.execute(
            `INSERT INTO vouchers (id, branch_id, item_id, item_name, quantity, remaining_quantity, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [randomVoucherId, branch_id, item_id, itemName, produce_quantity, produce_quantity]
        );

        /* 6️⃣ Deduct stock + insert production_materials */
        for (const m of materials) {
            const requiredQty = m.convertedRequiredQty;

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
                    m.quantity * recipeCount,
                    m.consume_unit_id
                ]
            );
        }

        await conn.commit();
        return production_id;

    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
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
         p.item_id,
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
