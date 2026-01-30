import connectDB from "../config/db.js";

export const createPurchaseOrder = async (data, items) => {
  const conn = await connectDB();

  try {
    await conn.beginTransaction();

    // 1️⃣ Purchase Order
    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders
      (branch_id, supplier_id, po_number, invoice_number,
       purchase_date, sub_total, tax_amount, discount_amount, grand_total,payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
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
