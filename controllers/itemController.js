import { createItem, getItemsByBranch } from "../models/itemModel.js";

/**
 * Create item
 */
export const createItemController = async (req, res) => {
  try {
    const { name, category, selling_price } = req.body;
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
      selling_price || 0
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

/**
 * Get items (branch-wise)
 */
export const getItemsController = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    const items = await getItemsByBranch(branch_id);

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
