import express from "express";
import {
  createSupplierController,
  getSuppliersController,
  getSupplierByIdController,
  deleteSupplierController,
  updateSupplierController
} from "../controllers/supplierController.js";
import userAuth from "../middlewares/userMiddleware.js";


const router = express.Router();

router.post("/create", userAuth, createSupplierController);
router.get("/get", userAuth, getSuppliersController);
router.get("/:id", userAuth, getSupplierByIdController);
router.put("/:id", userAuth, updateSupplierController);
router.delete("/:id", userAuth, deleteSupplierController);

export default router;
