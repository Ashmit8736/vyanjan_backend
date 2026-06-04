import express from "express";
import {
  createRawMaterial,
  getRawMaterials,
  updateRawMaterial,
  getRawMaterialLogs
} from "../controllers/rawMaterialController.js";
// import authMiddleware from "../middleware/auth.middleware.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/create", userAuth, createRawMaterial);
router.get("/get", userAuth, getRawMaterials);
router.put("/update/:id", userAuth, updateRawMaterial);
router.get("/logs/:id", userAuth, getRawMaterialLogs);

export default router;
