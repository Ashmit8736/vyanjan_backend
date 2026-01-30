import express from "express";
import { createStockPurchaseItemsController,getStockController } from "../controllers/stockPurchaseItemController.js";
import userAuth from "../middlewares/userMiddleware.js";


const router = express.Router();

router.post("/stock-purchase-items", userAuth, createStockPurchaseItemsController);

router.get("/stock", userAuth, getStockController);


export default router;
