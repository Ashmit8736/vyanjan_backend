import connectDB from "../config/db.js";

const RawMaterialStockModel = {

  upsertStock: async ({
    raw_material_id,
    branch_id,
    quantity_in_consume_unit
  }) => {
    const db = await connectDB();

    const sql = `
      INSERT INTO raw_material_stock
        (raw_material_id, branch_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity)
    `;

    await db.execute(sql, [
      raw_material_id,
      branch_id,
      quantity_in_consume_unit
    ]);
  },



  getAvailableStockByBranch: async (branch_id) => {
    const db = await connectDB();
    
    const sql = `
     SELECT
  rm.id AS raw_material_id,
  rm.name AS raw_material_name,
  rm.category,

  rms.quantity AS available_quantity_consume,

  cu.unit_name AS consume_unit,
  cu.unit_symbol AS consume_unit_symbol,

  (rms.quantity / rm.conversion_factor) 
    AS available_quantity_purchase,

  pu.unit_name AS purchase_unit,
  pu.unit_symbol AS purchase_unit_symbol

FROM raw_material_stock rms
JOIN raw_materials rm ON rm.id = rms.raw_material_id
JOIN units cu ON cu.id = rm.consume_unit_id
JOIN units pu ON pu.id = rm.purchase_unit_id

WHERE rms.branch_id = ?
  AND rm.is_active = 1
ORDER BY rm.category, rm.name;

    `;

    const [rows] = await db.execute(sql, [branch_id]);
    return rows;
  },

  getRawMaterialForStock: async (raw_material_id) => {
    const db = await connectDB();

    const [rows] = await db.execute(
      `
      SELECT
        consume_unit_id,
        purchase_unit_id,
        conversion_factor
      FROM raw_materials
      WHERE id = ?
      `,
      [raw_material_id]
    );

    return rows.length ? rows[0] : null;
  }
};

export default RawMaterialStockModel;


export const getCurrentStock = async ({ category, rawMaterial }) => {
  const db = await connectDB();   // ✅ ADD THIS LINE

  let conditions = [];
  let params = [];

  if (category && category !== "All") {
    conditions.push("rm.category = ?");
    params.push(category);
  }

  if (rawMaterial) {
    conditions.push("rm.name LIKE ?");
    params.push(`%${rawMaterial}%`);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

  const sql = `
    SELECT
      rm.category AS category,
      rm.name AS rawMaterial,
      rms.quantity AS quantity,
      cu.unit_symbol AS unit,
      IFNULL(AVG(spi.unit_price), 0) AS price,
      (rms.quantity * IFNULL(AVG(spi.unit_price), 0)) AS total
    FROM raw_material_stock rms
    JOIN raw_materials rm ON rm.id = rms.raw_material_id
    JOIN units cu ON cu.id = rm.consume_unit_id
    LEFT JOIN stock_purchase_items spi
      ON spi.raw_material_id = rm.id
    ${whereClause}
    GROUP BY rm.id, rms.quantity, cu.unit_symbol
    ORDER BY rm.name ASC
  `;

  const [rows] = await db.execute(sql, params);
  return rows;
};
