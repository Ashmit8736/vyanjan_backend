import express from "express";
import {
  setOpeningStock,
  getAvailableStock,
  fetchCurrentStock,
  updateStockController,
  getStockSummaryReport,
  getDashboardStatsController
} from "../controllers/StockController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post(
  "/stockAdd",
  userAuth,
  setOpeningStock
);

router.post(
  "/stockUpdate",
  userAuth,
  updateStockController
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

router.get(
  "/stockSummaryReport",
  userAuth,
  getStockSummaryReport
);

router.get(
  "/dashboard-stats",
  userAuth,
  getDashboardStatsController
);

export default router;
