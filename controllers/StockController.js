import RawMaterialStockModel from "../models/StockModel.js";


// ✅ OPENING / CURRENT STOCK (SET)
// export const setOpeningStock = async (req, res) => {
//   try {
//     const branch_id = req.user.branch_id;

//     const {
//       raw_material_id,
//       entered_quantity,
//       entered_unit_id
//     } = req.body;

//     if (!raw_material_id || !entered_quantity || !entered_unit_id) {
//       return res.status(400).json({
//         success: false,
//         message: "raw_material_id, entered_quantity, entered_unit_id required"
//       });
//     }

//     // 🔹 get raw material config
//     const rm =
//       await RawMaterialStockModel.getRawMaterialForStock(raw_material_id);

//     if (!rm) {
//       return res.status(404).json({
//         success: false,
//         message: "Raw material not found"
//       });
//     }

//     let finalQuantity;

//     // ✅ conversion logic
//     if (entered_unit_id === rm.consume_unit_id) {
//       finalQuantity = entered_quantity;
//     } else if (entered_unit_id === rm.purchase_unit_id) {
//       finalQuantity = entered_quantity * rm.conversion_factor;
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid unit for this raw material"
//       });
//     }

//     await RawMaterialStockModel.upsertStock({
//       raw_material_id,
//       branch_id,
//       quantity_in_consume_unit: finalQuantity
//     });

//     res.status(200).json({
//       success: true,
//       message: "Opening / current stock updated successfully",
//       stored_quantity: finalQuantity
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Stock update failed",
//       error: error.message
//     });
//   }
// };


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

    // 🔹 get raw material config
    const rm =
      await RawMaterialStockModel.getRawMaterialForStock(raw_material_id);

    if (!rm) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found"
      });
    }

    // ❌ consume unit bilkul allow nahi
    if (entered_unit_id !== rm.purchase_unit_id) {
      return res.status(400).json({
        success: false,
        message: "Stock sirf purchase unit me hi add ho sakta hai"
      });
    }

    // ✅ convert to consume unit
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


// ✅ GET AVAILABLE STOCK
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
