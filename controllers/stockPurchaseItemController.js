import connectDB from "../config/db.js";
import {
  createStockPurchaseItems,
  updateRawMaterialStockPurchase,
  getStockByBranch
} from "../models/stockPurchaseItemModel.js";

/**
 * PURCHASE → STOCK (PURCHASE UNIT ONLY)
 */
// export const createStockPurchaseItemsController = async (req, res) => {
//   const conn = await connectDB();

//   try {
//     await conn.beginTransaction();

//     const branch_id = req.user.branch_id;
//     const { purchase_order_id, items } = req.body;

//     if (!purchase_order_id || !items?.length) {
//       return res.status(400).json({
//         success: false,
//         message: "purchase_order_id and items are required"
//       });
//     }

//     const preparedItems = [];

//     for (const item of items) {

//       // 🔒 HARD CHECK: unit MUST be purchase unit
//       const [[rm]] = await conn.query(
//         `SELECT purchase_unit_id FROM raw_materials WHERE id = ?`,
//         [item.raw_material_id]
//       );

//       if (!rm) {
//         throw new Error("Invalid raw material");
//       }

//       if (item.unit_id !== rm.purchase_unit_id) {
//         throw new Error(
//           "Purchase stock must be added in PURCHASE UNIT only"
//         );
//       }

//       // 🔍 DEBUG (keep for now)
//       console.log(
//         "PURCHASE ADD =>",
//         "RM:", item.raw_material_id,
//         "QTY:", item.quantity,
//         "UNIT:", item.unit_id
//       );

//       const amount = item.quantity * item.unit_price;

//       const cgst_amount = amount * (item.cgst_percent || 0) / 100;
//       const sgst_amount = amount * (item.sgst_percent || 0) / 100;
//       const igst_amount = amount * (item.igst_percent || 0) / 100;

//       const final_amount =
//         amount +
//         cgst_amount +
//         sgst_amount +
//         igst_amount -
//         (item.item_discount || 0);

//       preparedItems.push({
//         purchase_order_id,
//         raw_material_id: item.raw_material_id,
//         branch_id,

//         quantity: item.quantity, // 🔒 PURCHASE QTY
//         unit_id: item.unit_id,

//         unit_price: item.unit_price,
//         amount,

//         cgst_percent: item.cgst_percent || 0,
//         sgst_percent: item.sgst_percent || 0,
//         igst_percent: item.igst_percent || 0,

//         cgst_amount,
//         sgst_amount,
//         igst_amount,

//         item_discount: item.item_discount || 0,
//         final_amount
//       });

//       // 🔒 STOCK UPDATE (NO CONVERSION EVER)
//       await updateRawMaterialStockPurchase(
//         item.raw_material_id,
//         branch_id,
//         item.quantity,
//         conn
//       );
//     }

//     await createStockPurchaseItems(preparedItems, conn);
//     await conn.commit();

//     res.status(201).json({
//       success: true,
//       message: "Purchase stock updated (purchase unit only)"
//     });

//   } catch (error) {
//     await conn.rollback();
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// export const createStockPurchaseItemsController = async (req, res) => {
//   const conn = await connectDB();

//   try {
//     await conn.beginTransaction();

//     const branch_id = req.user.branch_id;
//     const { purchase_order_id, items } = req.body;

//     if (!purchase_order_id || !items?.length) {
//       throw new Error("purchase_order_id and items required");
//     }

//     for (const item of items) {

//       // 1️⃣ purchase unit check
//       const [[rm]] = await conn.query(
//         `SELECT purchase_unit_id FROM raw_materials WHERE id = ?`,
//         [item.raw_material_id]
//       );

//       if (Number(item.unit_id) !== Number(rm.purchase_unit_id)) {
//         throw new Error("Purchase stock must be added in PURCHASE UNIT only");
//       }

//       // 2️⃣ stock update (NO conversion)
//       await updateRawMaterialStockPurchase(
//         item.raw_material_id,
//         branch_id,
//         item.quantity,   // 👈 DIRECT ADD
//         conn
//       );

//       // 3️⃣ purchase history save
//       await conn.query(
//         `INSERT INTO stock_purchase_items
//          (purchase_order_id, raw_material_id, branch_id,
//           quantity, unit_id, unit_price, amount,
//           cgst_percent, sgst_percent, igst_percent,
//           cgst_amount, sgst_amount, igst_amount,
//           item_discount, final_amount)
//          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//         [
//           purchase_order_id,
//           item.raw_material_id,
//           branch_id,

//           item.quantity,
//           item.unit_id,

//           item.unit_price,
//           item.quantity * item.unit_price,

//           item.cgst_percent || 0,
//           item.sgst_percent || 0,
//           item.igst_percent || 0,

//           0, 0, 0,
//           item.item_discount || 0,
//           (item.quantity * item.unit_price) - (item.item_discount || 0)
//         ]
//       );
//     }

//     await conn.commit();

//     res.json({
//       success: true,
//       message: "Purchase stock added in PURCHASE UNIT only"
//     });

//   } catch (err) {
//     await conn.rollback();
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

export const createStockPurchaseItemsController = async (req, res) => {
  const conn = await connectDB();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { purchase_order_id, items } = req.body;

    for (const item of items) {

      const [[rm]] = await conn.query(
        `SELECT purchase_unit_id FROM raw_materials WHERE id = ?`,
        [item.raw_material_id]
      );

      if (Number(item.unit_id) !== Number(rm.purchase_unit_id)) {
        throw new Error("Purchase stock must be added in PURCHASE UNIT only");
      }

      // 🔒 DIRECT ADD (NO conversion)
      await updateRawMaterialStockPurchase(
        item.raw_material_id,
        branch_id,
        item.quantity,
        conn
      );

      // history
      await conn.query(
        `INSERT INTO stock_purchase_items
         (purchase_order_id, raw_material_id, branch_id,
          quantity, unit_id, unit_price, amount,
          cgst_percent, sgst_percent, igst_percent,
          cgst_amount, sgst_amount, igst_amount,
          item_discount, final_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          purchase_order_id,
          item.raw_material_id,
          branch_id,
          item.quantity,
          item.unit_id,
          item.unit_price,
          item.quantity * item.unit_price,
          item.cgst_percent || 0,
          item.sgst_percent || 0,
          item.igst_percent || 0,
          0, 0, 0,
          item.item_discount || 0,
          (item.quantity * item.unit_price) - (item.item_discount || 0)
        ]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      message: "Purchase stock added correctly (purchase unit)"
    });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * GET STOCK (DISPLAY)
 */
export const getStockController = async (req, res) => {
  const data = await getStockByBranch(req.user.branch_id);
  res.json({ success: true, data });
};
