import { createItem, getItemsByBranch, updateItem, deleteItem, getItemLogs } from "../models/itemModel.js";

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

    // const affectedRows = await updateItem(
    //   item_id,
    //   name,
    //   category || null,
    //   selling_price || 0,
    //   short_code || null,
    //   stock_status || "Do Not Track",
    //   item_unit_id || null,
    //   favorite ? 1 : 0
    // );

    const affectedRows = await updateItem(
  item_id,
  branch_id,
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

// export const updateItemController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, category, selling_price, item_unit_id } = req.body;
//     const branch_id = req.user.branch_id;

//     if (!id || !name) {
//       return res.status(400).json({
//         success: false,
//         message: "Item ID and name are required",
//       });
//     }

//     await updateItem(id, branch_id, name, category, Number(selling_price || 0), item_unit_id ? Number(item_unit_id) : null);

//     res.status(200).json({
//       success: true,
//       message: "Item updated successfully",
//     });
//   } catch (error) {
//     console.error("Update Item Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating item",
//     });
//   }
// };

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
