import express from "express";
import {
  createItemController,
  getItemsController,
} from "../controllers/itemController.js";

import userAuth  from "../middlewares/userMiddleware.js";

const router = express.Router();

// create item
router.post(
  "/create",
  userAuth,
  createItemController
);

// get all items (branch-wise)
router.get(
  "/list",
  userAuth,
  getItemsController
);

export default router;
