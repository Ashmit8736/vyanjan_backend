import RawMaterialStockModel from "../models/StockModel.js";
import { getCurrentStock } from "../models/StockModel.js";

export const setOpeningStock = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    if (!branch_id) {
      return res.status(400).json({
        success: false,
        message: "Branch not assigned to user"
      });
    }

    const {
      raw_material_id,
      entered_quantity,
      entered_unit_id
    } = req.body;

    if (!raw_material_id || !entered_quantity || !entered_unit_id) {
      return res.status(400).json({
        success: false,
        message: "raw_material_id, entered_quantity, entered_unit_id required"
      });
    }

    const rm =
      await RawMaterialStockModel.getRawMaterialForStock(raw_material_id);

    if (!rm) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found"
      });
    }

    if (entered_unit_id !== rm.purchase_unit_id) {
      return res.status(400).json({
        success: false,
        message: "Stock sirf purchase unit me hi add ho sakta hai"
      });
    }

    const finalQuantity =
      entered_quantity * rm.conversion_factor;

    await RawMaterialStockModel.upsertStock({
      raw_material_id,
      branch_id,
      quantity_in_consume_unit: finalQuantity
    });

    res.status(200).json({
      success: true,
      message: "Opening / current stock updated successfully",
      stored_quantity_consume_unit: finalQuantity
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Stock update failed",
      error: error.message
    });
  }
};

export const getAvailableStock = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    const data =
      await RawMaterialStockModel.getAvailableStockByBranch(branch_id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Stock fetch failed",
      error: error.message
    });
  }
};

export const fetchCurrentStock = async (req, res) => {
  try {
    const { category, rawMaterial } = req.query;

    const data = await getCurrentStock({
      category,
      rawMaterial,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("❌ Current stock error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch current stock",
    });
  }
};

export const updateStockController = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    if (!branch_id) {
      return res.status(400).json({
        success: false,
        message: "Branch not assigned to user"
      });
    }

    const {
      raw_material_id,
      quantity,
      reason,
      comments
    } = req.body;

    if (!raw_material_id || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "raw_material_id and quantity required"
      });
    }

    await RawMaterialStockModel.setStockWithAdjustment({
      raw_material_id,
      branch_id,
      quantity_in_consume_unit: Number(quantity),
      reason,
      comments
    });

    res.status(200).json({
      success: true,
      message: "Stock updated successfully"
    });
  } catch (error) {
    console.error("❌ Update stock error:", error);
    res.status(500).json({
      success: false,
      message: "Stock update failed",
      error: error.message
    });
  }
};

export const getStockSummaryReport = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { fromDate, toDate, category, rawMaterial, unitType } = req.query;

    const data = await RawMaterialStockModel.getStockSummaryReport({
      branch_id,
      fromDate,
      toDate,
      category,
      rawMaterial,
      unitType
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ Stock summary report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stock summary report",
      error: error.message
    });
  }
};

export const getDashboardStatsController = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    if (!branch_id) {
      return res.status(400).json({
        success: false,
        message: "Branch not assigned to user"
      });
    }

    const data = await RawMaterialStockModel.getDashboardStats(branch_id);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("❌ Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message
    });
  }
};
