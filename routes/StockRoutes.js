import express from "express";
import {
  setOpeningStock,
  getAvailableStock
} from "../controllers/StockController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post(
  "/stockAdd",
  userAuth,
  setOpeningStock
);

router.get(
  "/stockAvailable",
  userAuth,
  getAvailableStock
);

export default router;
