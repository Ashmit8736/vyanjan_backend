import express from "express";
import {
  createRecipeController,
  getRecipeByItemController,
  updateRecipeController,
} from "../controllers/recipeController.js";

import  userAuth  from "../middlewares/userMiddleware.js";

const router = express.Router();

// create recipe
router.post(
  "/create",
  userAuth,
  createRecipeController
);

// update recipe
router.post(
  "/update",
  userAuth,
  updateRecipeController
);

// get recipe by item
router.get(
  "/item/:item_id",
  userAuth,
  getRecipeByItemController
);

export default router;
