import express from "express";
import {
  createItemController,
  getItemsController,
  updateItemController,
} from "../controllers/itemController.js";

import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

// create item
router.post(
  "/create",
  userAuth,
  createItemController
);

// update item
router.put(
  "/update/:id",
  userAuth,
  updateItemController
);

// get all items (branch-wise)
router.get(
  "/list",
  userAuth,
  getItemsController
);

export default router;
