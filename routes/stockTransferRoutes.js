import express from "express";
import { dispatchStock } from "../controllers/stockTransferController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/dispatch", userAuth, dispatchStock);

export default router;
