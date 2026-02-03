import {
  createRecipe,
  addRecipeMaterials,
  getRecipeByItem,
  checkRawMaterialStock,
} from "../models/recipeModel.js";

/**
 * Create recipe with materials
 */

export const createRecipeController = async (req, res) => {
  try {
    const {
      item_id,
      item_quantity,
      item_unit_id,
      materials,
    } = req.body;

    const branch_id = req.user.branch_id;

    // 🔐 Basic validation
    if (!item_id || !item_quantity || !item_unit_id) {
      return res.status(400).json({
        success: false,
        message: "Item quantity and unit are required",
      });
    }

    if (!materials || materials.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Recipe materials are required",
      });
    }

    // 🔥 STEP 1: STOCK CHECK (branch-wise)
    const stockCheck = await checkRawMaterialStock(materials, branch_id);

    if (!stockCheck.ok) {
      return res.status(400).json({
        success: false,
        message: stockCheck.message,
      });
    }

    // 🔥 STEP 2: CREATE RECIPE
    const recipe_id = await createRecipe(
      item_id,
      branch_id,
      item_quantity,
      item_unit_id
    );

    await addRecipeMaterials(recipe_id, materials);

    res.status(201).json({
      success: true,
      message: "Recipe created successfully",
      recipe_id,
    });
  } catch (error) {
    console.error("Create Recipe Error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating recipe",
    });
  }
};


/**
 * Get recipe by item
 */
export const getRecipeByItemController = async (req, res) => {
  try {
    const { item_id } = req.params;

    if (!item_id) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    const recipe = await getRecipeByItem(item_id);

    res.status(200).json({
      success: true,
      data: recipe,
    });
  } catch (error) {
    console.error("Get Recipe Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recipe",
    });
  }
};

