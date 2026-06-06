import express from "express";
import {
  getVouchersController,
  updateVoucherStatusController,
  importVouchersController,
  createVoucherController
} from "../controllers/voucherController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.get("/list", userAuth, getVouchersController);
router.post("/update-status", userAuth, updateVoucherStatusController);
router.post("/import", userAuth, importVouchersController);
router.post("/create", userAuth, createVoucherController);

export default router;
