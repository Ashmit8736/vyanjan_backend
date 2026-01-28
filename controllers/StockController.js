import RawMaterialStockModel from "../models/StockModel.js";

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
