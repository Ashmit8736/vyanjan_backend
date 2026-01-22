import express from "express";
import {getUnits, createUnit} from "../controllers/unitController.js";
// import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// 🔐 authMiddleware laga diya
router.post("/addUnit",createUnit);
router.get("/getUnit",getUnits);

export default router;
