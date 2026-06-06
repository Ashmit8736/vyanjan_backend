import connectDB from "../config/db.js";

/**
 * Insert purchase items (purchase unit only)
 */
export const createStockPurchaseItems = async (items, conn) => {
  for (const item of items) {
    await conn.query(
      `INSERT INTO stock_purchase_items
      (purchase_order_id, raw_material_id, branch_id,
       quantity, unit_id, unit_price, amount,
       cgst_percent, sgst_percent, igst_percent,
       cgst_amount, sgst_amount, igst_amount,
       item_discount, final_amount)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        item.purchase_order_id,
        item.raw_material_id,
        item.branch_id,

        item.quantity,     // 🔒 PURCHASE QTY
        item.unit_id,      // 🔒 PURCHASE UNIT

        item.unit_price,
        item.amount,

        item.cgst_percent,
        item.sgst_percent,
        item.igst_percent,

        item.cgst_amount,
        item.sgst_amount,
        item.igst_amount,

        item.item_discount || 0,
        item.final_amount
      ]
    );
  }
};

/**
 * Update stock (PURCHASE UNIT ONLY – NO CONVERSION)
 */
export const updateRawMaterialStockPurchase = async (
  raw_material_id,
  branch_id,
  quantity,
  conn
) => {
  const [[stock]] = await conn.query(
    `SELECT id FROM raw_material_stock
     WHERE raw_material_id = ? AND branch_id = ?`,
    [raw_material_id, branch_id]
  );

  if (stock) {
    await conn.query(
      `UPDATE raw_material_stock
       SET quantity = quantity + ?, last_updated_at = NOW()
       WHERE raw_material_id = ? AND branch_id = ?`,
      [quantity, raw_material_id, branch_id]
    );
  } else {
    await conn.query(
      `INSERT INTO raw_material_stock
       (raw_material_id, branch_id, quantity, last_updated_at)
       VALUES (?,?,?,NOW())`,
      [raw_material_id, branch_id, quantity]
    );
  }
};

/**
 * Get stock (CONVERSION ONLY FOR DISPLAY)
 */
// export const getStockByBranch = async (branchId) => {
//   const conn = await connectDB();

//   const [rows] = await conn.query(
//     `SELECT
//         rms.raw_material_id,
//         rm.name AS raw_material_name,

//         rms.quantity AS purchase_quantity,
//         pu.unit_name AS purchase_unit,
//         pu.unit_symbol AS purchase_unit_symbol,

//         (rms.quantity * rm.conversion_factor) AS consume_quantity,
//         cu.unit_name AS consume_unit,
//         cu.unit_symbol AS consume_unit_symbol,

//         rm.conversion_factor
//      FROM raw_material_stock rms
//      JOIN raw_materials rm ON rm.id = rms.raw_material_id
//      JOIN units pu ON pu.id = rm.purchase_unit_id
//      JOIN units cu ON cu.id = rm.consume_unit_id
//      WHERE rms.branch_id = ?
//      ORDER BY rm.name ASC`,
//     [branchId]
//   );

//   return rows;
// };


export const getStockByBranch = async (branchId) => {
  const conn = await connectDB();

  const [rows] = await conn.query(
    `SELECT
        rms.raw_material_id,
        rm.name AS raw_material_name,

        -- ✅ STOCK STORED IN CONSUME UNIT
        rms.quantity AS consume_quantity,
        cu.unit_name AS consume_unit,
        cu.unit_symbol AS consume_unit_symbol,

        -- ✅ DISPLAY PURCHASE QTY (DIVISION)
        (rms.quantity / rm.conversion_factor) AS purchase_quantity,
        pu.unit_name AS purchase_unit,
        pu.unit_symbol AS purchase_unit_symbol,

        rm.conversion_factor
     FROM raw_material_stock rms
     JOIN raw_materials rm ON rm.id = rms.raw_material_id
     JOIN units pu ON pu.id = rm.purchase_unit_id
     JOIN units cu ON cu.id = rm.consume_unit_id
     WHERE rms.branch_id = ?
     ORDER BY rm.name ASC`,
    [branchId]
  );

  return rows;
};



/* ===== GET STOCK LIST (SUMMARY) ===== */
export const getStockPurchaseList = async (branchId) => {
  const conn = await connectDB();

  const [rows] = await conn.query(
    `
    SELECT
      po.id,
      po.po_number,
      po.invoice_number,
      po.purchase_date AS invoice_date,
      s.name AS supplier_name,
      po.grand_total,
      po.tax_amount,
      po.payment_status,
      po.status,
      po.created_by,
      (SELECT COALESCE(SUM(paid_amount), 0) 
       FROM purchase_order_payments 
       WHERE purchase_order_id = po.id AND status = 'Active') AS total_paid
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE po.branch_id = ?
      AND po.status IN ('completed', 'cancelled')
    ORDER BY po.id DESC
    `,
    [branchId]
  );

  return rows;
};


export const getStockReportByPONumber = async (poNumber, branchId) => {
  const conn = await connectDB();

  const [[header]] = await conn.query(
    `
    SELECT
      po.id AS purchase_order_id,
      po.po_number,
      po.invoice_number,
      po.purchase_date AS invoice_date,
      s.name AS supplier_name
    FROM stock_purchase_items spi
    JOIN purchase_orders po ON po.id = spi.purchase_order_id
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE spi.branch_id = ?
      AND po.po_number = ?
    LIMIT 1
    `,
    [branchId, poNumber]
  );

  if (!header) {
    console.log("❌ HEADER NOT FOUND IN MODEL");
    return { header: null, items: [] };
  }

  const [items] = await conn.query(
    `
    SELECT
      spi.raw_material_id,
      rm.name AS rawMaterial,
      spi.quantity AS qty,
      spi.unit_id,
      u.unit_symbol AS unit,
      spi.unit_price AS price,
      spi.cgst_percent AS cgst,
      spi.sgst_percent AS sgst,
      spi.igst_percent AS igst,
      spi.item_discount AS discount,
      spi.final_amount AS total
    FROM stock_purchase_items spi
    JOIN raw_materials rm ON rm.id = spi.raw_material_id
    JOIN units u ON u.id = spi.unit_id
    WHERE spi.branch_id = ?
      AND spi.purchase_order_id = ?
    ORDER BY spi.id ASC
    `,
    [branchId, header.purchase_order_id]
  );


  return { header, items };
};
