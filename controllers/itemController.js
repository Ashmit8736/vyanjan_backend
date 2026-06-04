import { createItem, getItemsByBranch, updateItem } from "../models/itemModel.js";

/**
 * Create item
 */
export const createItemController = async (req, res) => {
  try {
    const {
      name,
      category,
      selling_price,
      short_code,
      stock_status,
      item_unit_id,
      favorite,
    } = req.body;
    const branch_id = req.user.branch_id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    const item_id = await createItem(
      branch_id,
      name,
      category || null,
      selling_price || 0,
      short_code || null,
      stock_status || "Do Not Track",
      item_unit_id || null,
      favorite ? 1 : 0
    );

    res.status(201).json({
      success: true,
      message: "Item created successfully",
      item_id,
    });
  } catch (error) {
    console.error("Create Item Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating item",
    });
  }
};

export const updateItemController = async (req, res) => {
  try {
    const item_id = req.params.id;
    const {
      name,
      category,
      selling_price,
      short_code,
      stock_status,
      item_unit_id,
      favorite,
    } = req.body;
    const branch_id = req.user.branch_id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    const affectedRows = await updateItem(
      item_id,
      name,
      category || null,
      selling_price || 0,
      short_code || null,
      stock_status || "Do Not Track",
      item_unit_id || null,
      favorite ? 1 : 0
    );

    if (!affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Item not found or could not be updated",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
    });
  } catch (error) {
    console.error("Update Item Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating item",
    });
  }
};

/**
 * Get items (branch-wise)
 */
// export const getItemsController = async (req, res) => {
//   try {
//     const branch_id = req.user.branch_id;

//     const items = await getItemsByBranch(branch_id);

//     res.status(200).json({
//       success: true,
//       data: items,
//     });
//   } catch (error) {
//     console.error("Get Items Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching items",
//     });
//   }
// };


export const getItemsController = async (req, res) => {
  try {
    console.log("USER =>", req.user);

    const branch_id = req.user.branch_id;
    console.log("BRANCH ID =>", branch_id);

    const items = await getItemsByBranch(branch_id);
    console.log("TOTAL ITEMS =>", items.length);

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Get Items Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
    });
  }
};