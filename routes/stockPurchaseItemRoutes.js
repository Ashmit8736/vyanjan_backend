import express from "express";
import { createStockPurchaseItemsController,getStockController, getStockReport, stockPurchaseList } from "../controllers/stockPurchaseItemController.js";
import userAuth from "../middlewares/userMiddleware.js";


const router = express.Router();

router.post("/stock-purchase-items", userAuth, createStockPurchaseItemsController);

router.get("/stock", userAuth, getStockController);
router.get("/stock-report/:poNumber", userAuth, getStockReport);
router.get(
  "/stockPurchaseItems/list/:branchId",
 userAuth,
  stockPurchaseList
);


export default router;
