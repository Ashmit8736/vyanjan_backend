import express from "express";
import { createPurchaseOrderController, getPurchaseOrdersController,getPurchaseOrderReportController } from "../controllers/purchaseOrderController.js";
import userAuth from "../middlewares/userMiddleware.js";


const router = express.Router();

router.post("/create", userAuth, createPurchaseOrderController);
router.get("/get", userAuth, getPurchaseOrdersController); 
// routes/purchaseOrderRoutes.js
router.get(
  "/purchase-orders/:id",
  userAuth,
  getPurchaseOrderReportController
);


export default router;
