import express from "express";
import {getUnits, createUnit, updateUnit, deleteUnit} from "../controllers/unitController.js";
// import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// 🔐 authMiddleware laga diya
router.post("/addUnit",createUnit);
router.get("/getUnit",getUnits);
router.put("/updateUnit/:id", updateUnit);
router.delete("/deleteUnit/:id", deleteUnit);

export default router;
