import express from "express";
import { 
  createStockPurchaseItemsController,
  getStockController, 
  getStockReport, 
  stockPurchaseList,
  cancelStockPurchaseController,
  updatePaymentStatusController,
  editStockPurchaseItemsController,
  getPaymentsController,
  addPaymentController,
  deletePaymentController,
  createDirectStockPurchaseController
} from "../controllers/stockPurchaseItemController.js";
import userAuth from "../middlewares/userMiddleware.js";


const router = express.Router();

router.post("/stock-purchase-items", userAuth, createStockPurchaseItemsController);
router.post("/direct-purchase", userAuth, createDirectStockPurchaseController);

router.get("/stock", userAuth, getStockController);
router.get("/stock-report/:poNumber", userAuth, getStockReport);
router.get(
  "/stockPurchaseItems/list/:branchId",
 userAuth,
  stockPurchaseList
);

router.put("/cancel/:poId", userAuth, cancelStockPurchaseController);
router.put("/payment-status/:poId", userAuth, updatePaymentStatusController);
router.put("/edit/:poId", userAuth, editStockPurchaseItemsController);

router.get("/payments/:poId", userAuth, getPaymentsController);
router.post("/payments/:poId", userAuth, addPaymentController);
router.delete("/payments/:paymentId", userAuth, deletePaymentController);


export default router;
