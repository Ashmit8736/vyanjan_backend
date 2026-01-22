import connectDB from "../config/db.js";

const RawMaterialModel = {

  create: async (data) => {
    const db = await connectDB();

    const sql = `
      INSERT INTO raw_materials (
        branch_id, name, category,
        purchase_unit_id, consume_unit_id, conversion_factor,
        purchase_price, tax_type, tax_percentage,
        minimum_stock_unit_id, minimum_stock_level,
        reorder_stock_unit_id, reorder_stock_level,
        stock_update_frequency, barcode, expiry_days
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const [result] = await db.execute(sql, [
      data.branch_id,
      data.name,
      data.category,

      data.purchase_unit_id,
      data.consume_unit_id,
      data.conversion_factor,

      data.purchase_price,
      data.tax_type,
      data.tax_percentage,

      data.minimum_stock_unit_id,
      data.minimum_stock_level,

      data.reorder_stock_unit_id,
      data.reorder_stock_level,

      data.stock_update_frequency,
      data.barcode,
      data.expiry_days
    ]);

    return result;
  },

  getAllByBranch: async (branch_id) => {
    const db = await connectDB();

    const sql = `
      SELECT
        rm.id,
        rm.name,
        rm.category,

        pu.unit_name AS purchase_unit,
        cu.unit_name AS consume_unit,
        rm.conversion_factor,

        rm.purchase_price,
        rm.tax_type,
        rm.tax_percentage,

        msu.unit_name AS minimum_stock_unit,
        rm.minimum_stock_level,

        rsu.unit_name AS reorder_stock_unit,
        rm.reorder_stock_level,

        rm.stock_update_frequency,
        rm.barcode,
        rm.expiry_days
      FROM raw_materials rm
      JOIN units pu ON pu.id = rm.purchase_unit_id
      JOIN units cu ON cu.id = rm.consume_unit_id
      LEFT JOIN units msu ON msu.id = rm.minimum_stock_unit_id
      LEFT JOIN units rsu ON rsu.id = rm.reorder_stock_unit_id
      WHERE rm.branch_id = ?
        AND rm.is_active = 1
      ORDER BY rm.name
    `;

    const [rows] = await db.execute(sql, [branch_id]);
    return rows;
  }
};

export default RawMaterialModel;
