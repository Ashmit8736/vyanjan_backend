import express from "express";
import { executeProduction, listProduction } from "../controllers/producationController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/create", userAuth, executeProduction);

router.get("/list", userAuth, listProduction);

export default router;
