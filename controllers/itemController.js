import { createItem, getItemsByBranch, updateItem, deleteItem, getItemLogs, checkDuplicateItem } from "../models/itemModel.js";

/**
  * Create item
  */
export const createItemController = async (req, res) => {
  try {
    const { name, category, selling_price, item_unit_id, short_code, stock_status, favorite } = req.body;
    const branch_id = req.user.branch_id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Item name is required",
      });
    }

    // Check for duplicate active item name in the same branch
    const isDuplicate = await checkDuplicateItem(name, branch_id);
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: "Item already exists (Duplicate entry)",
      });
    }

    const item_id = await createItem(
      branch_id,
      name,
      category || null,
      selling_price || 0,
      item_unit_id || null,
      short_code || null,
      stock_status || "In Stock",
      favorite ? Number(favorite) : 0
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

export const updateItemController = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, selling_price, item_unit_id, short_code, stock_status, favorite } = req.body;
    const branch_id = req.user.branch_id;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        message: "Item ID and name are required",
      });
    }

    // Check for duplicate active item name in the same branch (excluding current item)
    const isDuplicate = await checkDuplicateItem(name, branch_id, id);
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: "Item already exists with this name (Duplicate entry)",
      });
    }

    await updateItem(
      id,
      branch_id,
      name,
      category,
      Number(selling_price || 0),
      item_unit_id ? Number(item_unit_id) : null,
      short_code || null,
      stock_status || "In Stock",
      favorite ? Number(favorite) : 0
    );

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

export const deleteItemController = async (req, res) => {
  try {
    const { id } = req.params;
    const branch_id = req.user.branch_id;

    await deleteItem(id, branch_id);

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Delete Item Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting item",
    });
  }
};

export const getItemLogsController = async (req, res) => {
  try {
    const { id } = req.params;
    const branch_id = req.user.branch_id;

    const data = await getItemLogs(id, branch_id);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Item Logs Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching item logs",
    });
  }
};
