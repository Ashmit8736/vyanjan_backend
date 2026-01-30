import connectDB from "../config/db.js";
import { createPurchaseOrder, getPurchaseOrdersByBranch  } from "../models/purchaseOrderModel.js";

export const createPurchaseOrderController = async (req, res) => {
  try {
    const conn = await connectDB();
    const branch_id = req.user.branch_id;
    const {
      supplier_id,
      purchase_date,
      invoice_number,
      tax_amount = 0,
      discount_amount = 0,
      payment_status = 'pending',
      items
    } = req.body;

    if (!supplier_id || !purchase_date || !items?.length) {
      return res.status(400).json({
        success: false,
        message: "Supplier, purchase date and items are required"
      });
    }

    let subTotal = 0;
    const calculatedItems = [];

    for (const item of items) {
      // 🔹 Get purchase unit from raw_materials
      const [[raw]] = await conn.query(
        `SELECT purchase_unit_id
         FROM raw_materials
         WHERE id = ? AND branch_id = ? AND is_active = 1`,
        [item.raw_material_id, branch_id]
      );

      if (!raw) {
        return res.status(400).json({
          success: false,
          message: `Invalid raw material ID ${item.raw_material_id}`
        });
      }

      const total = item.quantity * item.unit_price;
      subTotal += total;

      calculatedItems.push({
        raw_material_id: item.raw_material_id,
        purchase_unit_id: raw.purchase_unit_id, // ✅ AUTO
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: total
      });
    }

    const taxAmount = tax_amount;
    const grandTotal = subTotal + taxAmount - discount_amount;

    const poNumber = `PO-${Date.now()}`;

    const data = [
      branch_id,
      supplier_id,
      poNumber,
      invoice_number || null,
      purchase_date,
      subTotal,
      taxAmount,
      discount_amount,
      grandTotal, 
      payment_status
    ];

    const purchaseOrderId = await createPurchaseOrder(data, calculatedItems);

    res.status(201).json({
      success: true,
      message: "Purchase bill created (unit auto from raw material, stock not updated)",
      purchase_order_id: purchaseOrderId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



export const getPurchaseOrdersController = async (req, res) => {
  try {
    const branchId = req.user.branch_id;

    const data = await getPurchaseOrdersByBranch(branchId);

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

