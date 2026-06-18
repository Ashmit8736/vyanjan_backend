import express from "express";
import {
  createSalesInvoiceController,
  getSalesInvoicesController,
  getSalesDashboardStatsController,
  getInvoiceDetailsController,
  updateInvoiceStatusController,
  updateSalesInvoiceController
} from "../controllers/salesInvoiceController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/create", userAuth, createSalesInvoiceController);
router.get("/list", userAuth, getSalesInvoicesController);
router.get("/dashboard-stats", userAuth, getSalesDashboardStatsController);
router.get("/details/:invoiceNumber", userAuth, getInvoiceDetailsController);
router.get("/public/details/:invoiceNumber", getInvoiceDetailsController);
router.put("/update-status/:id", userAuth, updateInvoiceStatusController);
router.put("/update/:invoiceNumber", userAuth, updateSalesInvoiceController);

export default router;
