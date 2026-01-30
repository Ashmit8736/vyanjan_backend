import {
  createSupplier,
  getSuppliersByBranch,
  getSupplierById,
  deleteSupplier
} from "../models/supplierModel.js";

/**
 * CREATE SUPPLIER
 */
export const createSupplierController = async (req, res) => {
  try {
    const { name, company_name, phone, billing_address } = req.body;

    // 🔴 Mandatory fields
    if (!name || !company_name || !phone || !billing_address) {
      return res.status(400).json({
        success: false,
        message: "Name, Company Name, Phone and Address are mandatory"
      });
    }

    const branch_id = req.user.branch_id; // 🔑 branch from login

    const data = [
      branch_id,
      name,
      company_name,
      req.body.email || null,
      phone,

      billing_address,
      req.body.billing_state || null,
      req.body.billing_city || null,
      req.body.billing_pincode || null,

      req.body.shipping_address || null,
      req.body.shipping_state || null,
      req.body.shipping_city || null,
      req.body.shipping_pincode || null,

      req.body.gst_number || null,
      req.body.pan || null,
      req.body.fssai_license || null,
      req.body.msme_number || null,
      req.body.tan || null,
      req.body.cin || null,

      req.body.tcs_applicable || 0,
      req.body.tcs_type || null,
      req.body.tcs_percentage || 0
    ];

    await createSupplier(data);

    res.status(201).json({
      success: true,
      message: "Supplier created successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET ALL SUPPLIERS (BRANCH WISE)
 */
export const getSuppliersController = async (req, res) => {
  try {
    const branchId = req.user.branch_id;

    const data = await getSuppliersByBranch(branchId);

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

/**
 * GET SUPPLIER BY ID
 */
export const getSupplierByIdController = async (req, res) => {
  try {
    const branchId = req.user.branch_id;
    const supplierId = req.params.id;

    const data = await getSupplierById(supplierId, branchId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }

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

/**
 * DELETE SUPPLIER
 */
export const deleteSupplierController = async (req, res) => {
  try {
    const branchId = req.user.branch_id;
    const supplierId = req.params.id;

    await deleteSupplier(supplierId, branchId);

    res.json({
      success: true,
      message: "Supplier deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
