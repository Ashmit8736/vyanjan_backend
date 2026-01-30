// import connectDB from "../config/db.js";

// export const createStockPurchaseItems = async (items, conn) => {
//   for (const item of items) {
//     await conn.query(
//       `INSERT INTO stock_purchase_items
//       (purchase_order_id, raw_material_id, branch_id,
//        quantity, unit_id, unit_price, amount,
//        cgst_percent, sgst_percent, igst_percent,
//        cgst_amount, sgst_amount, igst_amount,
//        item_discount, final_amount)
//       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//       [
//         item.purchase_order_id,
//         item.raw_material_id,
//         item.branch_id,

//         item.quantity,
//         item.unit_id,

//         item.unit_price,
//         item.amount,

//         item.cgst_percent,
//         item.sgst_percent,
//         item.igst_percent,

//         item.cgst_amount,
//         item.sgst_amount,
//         item.igst_amount,

//         item.item_discount,
//         item.final_amount
//       ]
//     );
//   }
// };

// // 🔒 NO CONVERSION HERE
// export const updateRawMaterialStock = async (
//   raw_material_id,
//   branch_id,
//   quantity,
//   conn
// ) => {
//   const [[stock]] = await conn.query(
//     `SELECT id FROM raw_material_stock
//      WHERE raw_material_id = ? AND branch_id = ?`,
//     [raw_material_id, branch_id]
//   );

//   if (stock) {
//     await conn.query(
//       `UPDATE raw_material_stock
//        SET quantity = quantity + ?, last_updated_at = NOW()
//        WHERE raw_material_id = ? AND branch_id = ?`,
//       [quantity, raw_material_id, branch_id]
//     );
//   } else {
//     await conn.query(
//       `INSERT INTO raw_material_stock
//        (raw_material_id, branch_id, quantity, last_updated_at)
//        VALUES (?,?,?,NOW())`,
//       [raw_material_id, branch_id, quantity]
//     );
//   }
// };

// // 👀 CONVERSION ONLY FOR DISPLAY
// export const getStockByBranch = async (branchId) => {
//   const conn = await connectDB();

//   const [rows] = await conn.query(
//     `SELECT
//         rms.raw_material_id,
//         rm.name AS raw_material_name,

//         rms.quantity AS purchase_quantity,
//         pu.unit_name AS purchase_unit,

//         (rms.quantity * rm.conversion_factor) AS show_quantity,
//         cu.unit_name AS consume_unit,

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


// export const updateRawMaterialStockPurchase = async (
//   raw_material_id,
//   branch_id,
//   quantity,
//   conn
// ) => {
//   const [[stock]] = await conn.query(
//     `SELECT id FROM raw_material_stock
//      WHERE raw_material_id = ? AND branch_id = ?`,
//     [raw_material_id, branch_id]
//   );

//   if (stock) {
//     await conn.query(
//       `UPDATE raw_material_stock
//        SET quantity = quantity + ?, last_updated_at = NOW()
//        WHERE raw_material_id = ? AND branch_id = ?`,
//       [quantity, raw_material_id, branch_id]
//     );
//   } else {
//     await conn.query(
//       `INSERT INTO raw_material_stock
//        (raw_material_id, branch_id, quantity, last_updated_at)
//        VALUES (?,?,?,NOW())`,
//       [raw_material_id, branch_id, quantity]
//     );
//   }
// };


// import connectDB from "../config/db.js";

// // 1️⃣ INSERT PURCHASE ITEMS
// export const createStockPurchaseItems = async (items, conn) => {
//   for (const item of items) {
//     await conn.query(
//       `INSERT INTO stock_purchase_items
//       (purchase_order_id, raw_material_id, branch_id,
//        quantity, unit_id, unit_price, amount,
//        cgst_percent, sgst_percent, igst_percent,
//        cgst_amount, sgst_amount, igst_amount,
//        item_discount, final_amount)
//       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//       [
//         item.purchase_order_id,
//         item.raw_material_id,
//         item.branch_id,

//         item.quantity,
//         item.unit_id,

//         item.unit_price,
//         item.amount,

//         item.cgst_percent,
//         item.sgst_percent,
//         item.igst_percent,

//         item.cgst_amount,
//         item.sgst_amount,
//         item.igst_amount,

//         item.item_discount,
//         item.final_amount
//       ]
//     );
//   }
// };

// // 2️⃣ UPDATE STOCK (PURCHASE UNIT ONLY)
// export const updateRawMaterialStockPurchase = async (
//   raw_material_id,
//   branch_id,
//   quantity,
//   conn
// ) => {
//   const [[stock]] = await conn.query(
//     `SELECT id FROM raw_material_stock
//      WHERE raw_material_id = ? AND branch_id = ?`,
//     [raw_material_id, branch_id]
//   );

//   if (stock) {
//     await conn.query(
//       `UPDATE raw_material_stock
//        SET quantity = quantity + ?, last_updated_at = NOW()
//        WHERE raw_material_id = ? AND branch_id = ?`,
//       [quantity, raw_material_id, branch_id]
//     );
//   } else {
//     await conn.query(
//       `INSERT INTO raw_material_stock
//        (raw_material_id, branch_id, quantity, last_updated_at)
//        VALUES (?,?,?,NOW())`,
//       [raw_material_id, branch_id, quantity]
//     );
//   }
// };

// // 3️⃣ GET STOCK (CONVERSION ONLY FOR DISPLAY)
// export const getStockByBranch = async (branchId) => {
//   const conn = await connectDB();

//   const [rows] = await conn.query(
//     `SELECT
//         rms.raw_material_id,
//         rm.name AS raw_material_name,

//         rms.quantity AS purchase_quantity,
//         pu.unit_name AS purchase_unit,
//         pu.unit_symbol AS purchase_unit_symbol,

//         (rms.quantity * rm.conversion_factor) AS display_quantity,
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


// import connectDB from "../config/db.js";

// // 1️⃣ INSERT PURCHASE ITEMS (unchanged, purchase unit)
// export const createStockPurchaseItems = async (items, conn) => {
//   for (const item of items) {
//     await conn.query(
//       `INSERT INTO stock_purchase_items
//       (purchase_order_id, raw_material_id, branch_id,
//        quantity, unit_id, unit_price, amount,
//        cgst_percent, sgst_percent, igst_percent,
//        cgst_amount, sgst_amount, igst_amount,
//        item_discount, final_amount)
//       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//       [
//         item.purchase_order_id,
//         item.raw_material_id,
//         item.branch_id,

//         item.quantity,        // 🔒 purchase qty
//         item.unit_id,         // 🔒 purchase unit

//         item.unit_price,
//         item.amount,

//         item.cgst_percent,
//         item.sgst_percent,
//         item.igst_percent,

//         item.cgst_amount,
//         item.sgst_amount,
//         item.igst_amount,

//         item.item_discount || 0,
//         item.final_amount
//       ]
//     );
//   }
// };

// // 2️⃣ PURCHASE-ONLY STOCK UPDATE (NO CONVERSION)
// export const updateRawMaterialStockPurchase = async (
//   raw_material_id,
//   branch_id,
//   quantity,
//   conn
// ) => {
//   const [[stock]] = await conn.query(
//     `SELECT id FROM raw_material_stock
//      WHERE raw_material_id = ? AND branch_id = ?`,
//     [raw_material_id, branch_id]
//   );

//   if (stock) {
//     await conn.query(
//       `UPDATE raw_material_stock
//        SET quantity = quantity + ?, last_updated_at = NOW()
//        WHERE raw_material_id = ? AND branch_id = ?`,
//       [quantity, raw_material_id, branch_id]
//     );
//   } else {
//     await conn.query(
//       `INSERT INTO raw_material_stock
//        (raw_material_id, branch_id, quantity, last_updated_at)
//        VALUES (?,?,?,NOW())`,
//       [raw_material_id, branch_id, quantity]
//     );
//   }
// };

// // 3️⃣ GET STOCK (DISPLAY CONVERSION ONLY)
// export const getStockByBranch = async (branchId) => {
//   const conn = await connectDB();

//   const [rows] = await conn.query(
//     `SELECT
//         rms.raw_material_id,
//         rm.name AS raw_material_name,

//         rms.quantity AS purchase_quantity,
//         pu.unit_name AS purchase_unit,
//         pu.unit_symbol AS purchase_unit_symbol,

//         (rms.quantity * rm.conversion_factor) AS display_quantity,
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
export const getStockByBranch = async (branchId) => {
  const conn = await connectDB();

  const [rows] = await conn.query(
    `SELECT
        rms.raw_material_id,
        rm.name AS raw_material_name,

        rms.quantity AS purchase_quantity,
        pu.unit_name AS purchase_unit,
        pu.unit_symbol AS purchase_unit_symbol,

        (rms.quantity * rm.conversion_factor) AS consume_quantity,
        cu.unit_name AS consume_unit,
        cu.unit_symbol AS consume_unit_symbol,

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
