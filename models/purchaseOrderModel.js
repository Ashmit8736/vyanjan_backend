// import connectDB from "../config/db.js";

// export const createPurchaseOrder = async (data, items) => {
//   const db = await connectDB();
//   const conn = await db.getConnection();

//   try {
//     await conn.beginTransaction();

//     // 1️⃣ Insert Purchase Order
//     const [poResult] = await conn.query(
//       `INSERT INTO purchase_orders
//       (branch_id, supplier_id, po_number, invoice_number,
//        purchase_date, sub_total, tax_amount, discount_amount, grand_total)
//        VALUES (?,?,?,?,?,?,?,?,?)`,
//       data
//     );

//     const purchaseOrderId = poResult.insertId;

//     // 2️⃣ Insert Items + Update Stock
//     for (const item of items) {

//       // insert item
//       await conn.query(
//         `INSERT INTO purchase_order_items
//         (purchase_order_id, raw_material_id, quantity, unit_price, total_amount)
//         VALUES (?,?,?,?,?)`,
//         [
//           purchaseOrderId,
//           item.raw_material_id,
//           item.quantity,
//           item.unit_price,
//           item.total_amount
//         ]
//       );

//       // check stock exists
//       const [stock] = await conn.query(
//         `SELECT id FROM raw_material_stock
//          WHERE raw_material_id = ? AND branch_id = ?`,
//         [item.raw_material_id, data[0]]
//       );

//       if (stock.length > 0) {
//         // update stock
//         await conn.query(
//           `UPDATE raw_material_stock
//            SET quantity = quantity + ?
//            WHERE raw_material_id = ? AND branch_id = ?`,
//           [item.quantity, item.raw_material_id, data[0]]
//         );
//       } else {
//         // insert stock
//         await conn.query(
//           `INSERT INTO raw_material_stock
//            (raw_material_id, branch_id, quantity)
//            VALUES (?,?,?)`,
//           [item.raw_material_id, data[0], item.quantity]
//         );
//       }
//     }

//     await conn.commit();
//     return purchaseOrderId;

//   } catch (error) {
//     await conn.rollback();
//     throw error;
//   } finally {
//     conn.release();
//   }
// };


// import connectDB from "../config/db.js";

// export const createPurchaseOrder = async (data, items) => {
//   const conn = await connectDB(); // 👈 direct connection

//   try {
//     await conn.beginTransaction();

//     // 1️⃣ Insert Purchase Order
//     const [poResult] = await conn.query(
//       `INSERT INTO purchase_orders
//       (branch_id, supplier_id, po_number, invoice_number,
//        purchase_date, sub_total, tax_amount, discount_amount, grand_total)
//        VALUES (?,?,?,?,?,?,?,?,?)`,
//       data
//     );

//     const purchaseOrderId = poResult.insertId;

//     // 2️⃣ Insert Items + Update Stock
//     for (const item of items) {

//       // insert purchase item
//       await conn.query(
//         `INSERT INTO purchase_order_items
//         (purchase_order_id, raw_material_id, quantity, unit_price, total_amount)
//         VALUES (?,?,?,?,?)`,
//         [
//           purchaseOrderId,
//           item.raw_material_id,
//           item.quantity,
//           item.unit_price,
//           item.total_amount
//         ]
//       );

//       // check stock exists
//       const [stock] = await conn.query(
//         `SELECT quantity FROM raw_material_stock
//          WHERE raw_material_id = ? AND branch_id = ?`,
//         [item.raw_material_id, data[0]] // data[0] = branch_id
//       );

//       if (stock.length > 0) {
//         // update stock
//         await conn.query(
//           `UPDATE raw_material_stock
//            SET quantity = quantity + ?
//            WHERE raw_material_id = ? AND branch_id = ?`,
//           [item.quantity, item.raw_material_id, data[0]]
//         );
//       } else {
//         // insert stock
//         await conn.query(
//           `INSERT INTO raw_material_stock
//            (raw_material_id, branch_id, quantity)
//            VALUES (?,?,?)`,
//           [item.raw_material_id, data[0], item.quantity]
//         );
//       }
//     }

//     await conn.commit();
//     return purchaseOrderId;

//   } catch (error) {
//     await conn.rollback();
//     throw error;
//   }
// };


import connectDB from "../config/db.js";

export const createPurchaseOrder = async (data, items) => {
  const conn = await connectDB();

  try {
    await conn.beginTransaction();

    // 1️⃣ Purchase Order
    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders
      (branch_id, supplier_id, po_number, invoice_number,
       purchase_date, sub_total, tax_amount, discount_amount, grand_total)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      data
    );

    const purchaseOrderId = poResult.insertId;

    // 2️⃣ Purchase Items (NO STOCK UPDATE)
    for (const item of items) {
      await conn.query(
        `INSERT INTO purchase_order_items
        (purchase_order_id, raw_material_id, purchase_unit_id,
         quantity, unit_price, total_amount)
        VALUES (?,?,?,?,?,?)`,
        [
          purchaseOrderId,
          item.raw_material_id,
          item.purchase_unit_id,
          item.quantity,
          item.unit_price,
          item.total_amount
        ]
      );
    }

    await conn.commit();
    return purchaseOrderId;

  } catch (error) {
    await conn.rollback();
    throw error;
  }
};

export const getPurchaseOrdersByBranch = async (branchId) => {
  const conn = await connectDB();

  const [rows] = await conn.query(
    `SELECT 
        po.id,
        po.po_number,
        po.invoice_number,
        po.purchase_date,
        po.sub_total,
        po.tax_amount,
        po.discount_amount,
        po.grand_total,
        po.payment_status,
        po.created_at,
        s.name AS supplier_name,
        s.company_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.branch_id = ?
     ORDER BY po.created_at DESC`,
    [branchId]
  );

  return rows;
};
