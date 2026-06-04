import express from "express";
import {
  createItemController,
  getItemsController,
  updateItemController,
  deleteItemController,
  getItemLogsController
} from "../controllers/itemController.js";
import userAuth from "../middlewares/userMiddleware.js";

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

// update item
router.put(
  "/update/:id",
  userAuth,
  updateItemController
);

// delete item
router.delete(
  "/delete/:id",
  userAuth,
  deleteItemController
);

// view item logs
router.get(
  "/logs/:id",
  userAuth,
  getItemLogsController
);

export default router;
