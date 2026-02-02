import connectDB from "../config/db.js";
import {
  createStockPurchaseItems,
  updateRawMaterialStockPurchase,
  getStockByBranch
} from "../models/stockPurchaseItemModel.js";

export const createStockPurchaseItemsController = async (req, res) => {
  const conn = await connectDB();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { purchase_order_id, items } = req.body;


for (const item of items) {

  const [[rm]] = await conn.query(
    `SELECT purchase_unit_id, conversion_factor
     FROM raw_materials
     WHERE id = ?`,
    [item.raw_material_id]
  );

  if (Number(item.unit_id) !== Number(rm.purchase_unit_id)) {
    throw new Error("Purchase stock must be added in PURCHASE UNIT only");
  }

  // ✅ CONVERT purchase → consume
  const convertedQuantity =
    item.quantity * rm.conversion_factor;

  // ✅ always store consume unit
  await updateRawMaterialStockPurchase(
    item.raw_material_id,
    branch_id,
    convertedQuantity,
    conn
  );

  // history same rahegi

  //  const amount = item.quantity * item.unit_price;
  //     const itemDiscount = item.item_discount || 0;
  //     const finalAmount = amount - itemDiscount;

  const amount = item.quantity * item.unit_price;
const itemDiscount = item.item_discount || 0;

// GST calculation
let cgstAmount = 0;
let sgstAmount = 0;
let igstAmount = 0;

if (item.igst_percent && item.igst_percent > 0) {
  // Inter-state
  igstAmount = amount * (item.igst_percent / 100);
} else {
  // Intra-state
  cgstAmount = amount * ((item.cgst_percent || 0) / 100);
  sgstAmount = amount * ((item.sgst_percent || 0) / 100);
}

const totalTax = cgstAmount + sgstAmount + igstAmount;

// ✅ Final amount
const finalAmount = amount + totalTax - itemDiscount;


      // 🔹 Insert purchase history (store ORIGINAL purchase data)
      // await conn.query(
      //   `INSERT INTO stock_purchase_items
      //    (
      //      purchase_order_id,
      //      raw_material_id,
      //      branch_id,
      //      quantity,
      //      unit_id,
      //      unit_price,
      //      amount,
      //      cgst_percent,
      //      sgst_percent,
      //      igst_percent,
      //      cgst_amount,
      //      sgst_amount,
      //      igst_amount,
      //      item_discount,
      //      final_amount
      //    )
      //    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      //   [
      //     purchase_order_id,
      //     item.raw_material_id,
      //     branch_id,
      //     item.quantity,           // purchase qty
      //     item.unit_id,            // purchase unit
      //     item.unit_price,
      //     amount,
      //     item.cgst_percent || 0,
      //     item.sgst_percent || 0,
      //     item.igst_percent || 0,
      //     0, 0, 0,                  // tax calc later if needed
      //     itemDiscount,
      //     finalAmount
      //   ]
      // );

      await conn.query(
  `INSERT INTO stock_purchase_items
   (
     purchase_order_id,
     raw_material_id,
     branch_id,
     quantity,
     unit_id,
     unit_price,
     amount,
     cgst_percent,
     sgst_percent,
     igst_percent,
     cgst_amount,
     sgst_amount,
     igst_amount,
     item_discount,
     final_amount
   )
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [
    purchase_order_id,
    item.raw_material_id,
    branch_id,
    item.quantity,
    item.unit_id,
    item.unit_price,
    amount,
    item.cgst_percent || 0,
    item.sgst_percent || 0,
    item.igst_percent || 0,
    cgstAmount,
    sgstAmount,
    igstAmount,
    itemDiscount,
    finalAmount
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

