import express from "express";
import { getTokenStatsController } from "../controllers/tokenController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.get("/stats", userAuth, getTokenStatsController);

export default router;
