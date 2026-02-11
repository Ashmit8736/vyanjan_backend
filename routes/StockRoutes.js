import express from "express";
import {
  setOpeningStock,
  getAvailableStock,
  fetchCurrentStock
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

router.get(
  "/report-currentStock",
  userAuth,
  fetchCurrentStock
);

export default router;
