import express from "express";
import {
  getVouchersController,
  updateVoucherStatusController,
  importVouchersController,
  createVoucherController,
  getSentVouchersDetailsController,
  forwardStockController
} from "../controllers/voucherController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.get("/list", userAuth, getVouchersController);
router.post("/update-status", userAuth, updateVoucherStatusController);
router.post("/import", userAuth, importVouchersController);
router.post("/create", userAuth, createVoucherController);
router.post("/forward", userAuth, forwardStockController);
router.get("/sent-details", userAuth, getSentVouchersDetailsController);

export default router;

