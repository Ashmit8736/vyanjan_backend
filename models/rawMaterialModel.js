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

        rm.purchase_unit_id,
        pu.unit_name AS purchase_unit,
        rm.consume_unit_id,
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
  },

  update: async (id, branch_id, data) => {
    const db = await connectDB();

    const sql = `
      UPDATE raw_materials SET
        name = ?,
        category = ?,
        purchase_unit_id = ?,
        consume_unit_id = ?,
        conversion_factor = ?,
        purchase_price = ?,
        tax_type = ?,
        tax_percentage = ?,
        minimum_stock_unit_id = ?,
        minimum_stock_level = ?,
        reorder_stock_unit_id = ?,
        reorder_stock_level = ?,
        stock_update_frequency = ?,
        barcode = ?,
        expiry_days = ?
      WHERE id = ? AND branch_id = ?
    `;

    const [result] = await db.execute(sql, [
      data.name,
      data.category,
      Number(data.purchase_unit_id),
      Number(data.consume_unit_id),
      Number(data.conversion_factor),
      Number(data.purchase_price),
      data.tax_type,
      Number(data.tax_percentage),
      Number(data.minimum_stock_unit_id),
      Number(data.minimum_stock_level),
      Number(data.reorder_stock_unit_id),
      Number(data.reorder_stock_level),
      data.stock_update_frequency,
      data.barcode,
      Number(data.expiry_days),
      id,
      branch_id
    ]);

    return result;
  },

  getLogs: async (id, branch_id) => {
    const db = await connectDB();

    const sql = `
      SELECT 
        'Creation' AS type,
        rm.created_at AS date,
        NULL AS quantity,
        NULL AS unit_symbol,
        'Material registered in system' AS details
      FROM raw_materials rm
      WHERE rm.id = ? AND rm.branch_id = ?

      UNION ALL

      SELECT 
        'Purchase' AS type,
        spi.created_at AS date,
        spi.quantity AS quantity,
        u.unit_symbol AS unit_symbol,
        CONCAT('Purchased via PO #', po.po_number) AS details
      FROM stock_purchase_items spi
      JOIN purchase_orders po ON po.id = spi.purchase_order_id
      LEFT JOIN units u ON u.id = spi.unit_id
      WHERE spi.raw_material_id = ? AND spi.branch_id = ?

      UNION ALL

      SELECT 
        'Production' AS type,
        pm.created_at AS date,
        -pm.quantity AS quantity,
        u.unit_symbol AS unit_symbol,
        CONCAT('Used in Production #', pm.production_id) AS details
      FROM production_materials pm
      LEFT JOIN units u ON u.id = pm.unit_id
      JOIN production p ON p.id = pm.production_id
      WHERE pm.raw_material_id = ? AND p.branch_id = ?

      ORDER BY date DESC
    `;

    const [rows] = await db.execute(sql, [id, branch_id, id, branch_id, id, branch_id]);
    return rows;
  }
};

export default RawMaterialModel;
