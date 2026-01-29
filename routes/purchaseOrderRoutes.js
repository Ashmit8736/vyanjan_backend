import express from "express";
import { createPurchaseOrderController, getPurchaseOrdersController } from "../controllers/purchaseOrderController.js";
import userAuth from "../middlewares/userMiddleware.js";


const router = express.Router();

router.post("/create", userAuth, createPurchaseOrderController);
router.get("/get", userAuth, getPurchaseOrdersController); 

export default router;
