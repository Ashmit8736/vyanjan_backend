import express from "express";
import {
  setOpeningStock,
  getAvailableStock
} from "../controllers/StockController.js";
// import authMiddleware from "../middleware/auth.middleware.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

// 🔹 Set / Update opening stock
router.post(
  "/stockAdd",
  userAuth,
  setOpeningStock
);

// 🔹 Get available stock
router.get(
  "/stockAvailable",
  userAuth,
  getAvailableStock
);

export default router;
