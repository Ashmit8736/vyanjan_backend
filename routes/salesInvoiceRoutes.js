import express from "express";
import {
  createSalesInvoiceController,
  getSalesInvoicesController
} from "../controllers/salesInvoiceController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/create", userAuth, createSalesInvoiceController);
router.get("/list", userAuth, getSalesInvoicesController);

export default router;
