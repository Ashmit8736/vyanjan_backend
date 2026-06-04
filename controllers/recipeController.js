import {
  createRecipe,
  addRecipeMaterials,
  getRecipeByItem,
  checkRawMaterialStock,
} from "../models/recipeModel.js";
import connectDB from "../config/db.js";

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

export const updateRecipeController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      item_id,
      item_quantity,
      item_unit_id,
      materials,
    } = req.body;

    const branch_id = req.user.branch_id;

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

    // 1. Soft-delete old active recipe(s) for this item in this branch
    await conn.execute(
      `UPDATE recipes SET is_active = 0 WHERE item_id = ? AND branch_id = ? AND is_active = 1`,
      [item_id, branch_id]
    );

    // 2. Insert new recipe header
    const [recipeResult] = await conn.execute(
      `INSERT INTO recipes (item_id, branch_id, item_quantity, item_unit_id)
       VALUES (?, ?, ?, ?)`,
      [item_id, branch_id, item_quantity, item_unit_id]
    );
    const recipe_id = recipeResult.insertId;

    // 3. Insert new materials
    const values = materials.map((m) => [
      recipe_id,
      m.raw_material_id,
      m.quantity,
      m.consume_unit_id,
    ]);

    await conn.query(
      `INSERT INTO recipe_materials (recipe_id, raw_material_id, quantity, consume_unit_id)
       VALUES ?`,
      [values]
    );

    await conn.commit();

    res.status(200).json({
      success: true,
      message: "Recipe updated successfully",
      recipe_id,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Update Recipe Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating recipe",
    });
  } finally {
    conn.release();
  }
};

