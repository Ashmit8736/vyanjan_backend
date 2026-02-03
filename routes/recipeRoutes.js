import express from "express";
import {
  createRecipeController,
  getRecipeByItemController,
} from "../controllers/recipeController.js";

import  userAuth  from "../middlewares/userMiddleware.js";

const router = express.Router();

// create recipe
router.post(
  "/create",
  userAuth,
  createRecipeController
);

// get recipe by item
router.get(
  "/item/:item_id",
  userAuth,
  getRecipeByItemController
);

export default router;
