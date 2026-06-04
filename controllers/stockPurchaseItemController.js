import connectDB from "../config/db.js";
import {
  createStockPurchaseItems,
  updateRawMaterialStockPurchase,
  getStockByBranch,
  // getStockReportByPOId,
   getStockPurchaseList,
   getStockReportByPONumber
} from "../models/stockPurchaseItemModel.js";

export const createStockPurchaseItemsController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { purchase_order_id, invoice_number, invoice_date, payment_status, items } = req.body;

    // Update the purchase order status to completed and persist invoice details and payment status
    await conn.execute(
      `UPDATE purchase_orders
       SET status = 'completed',
           payment_status = ?,
           invoice_number = ?,
           purchase_date = ?
       WHERE id = ?`,
      [
        payment_status || 'pending',
        invoice_number || null,
        invoice_date || null,
        purchase_order_id
      ]
    );


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
  } finally {
    conn.release();
  }
};


/**
 * GET STOCK (DISPLAY)
 */
export const getStockController = async (req, res) => {
  const data = await getStockByBranch(req.user.branch_id);
  res.json({ success: true, data });
};




/* ===== GET STOCK PURCHASE LIST ===== */
export const stockPurchaseList = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required"
      });
    }

    const data = await getStockPurchaseList(branchId);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ Stock Purchase List Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


export const getStockReport = async (req, res) => {
  try {
    const { poNumber } = req.params;
    const branchId = req.user.branch_id;


    const data = await getStockReportByPONumber(poNumber, branchId);

    if (!data.header) {
      return res.status(404).json({
        message: "No stock purchase entries found for this PO",
      });
    }

    res.json({
      success: true,
      header: data.header,
      items: data.items,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
