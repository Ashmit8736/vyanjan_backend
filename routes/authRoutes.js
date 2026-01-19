import express from "express";
import { unifiedLogin } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", unifiedLogin);

export default router;
