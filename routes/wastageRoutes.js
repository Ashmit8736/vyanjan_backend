import express from "express";
import {
  createWastageRecordController,
  getWastageRecordsController,
  deleteWastageRecordController
} from "../controllers/wastageController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/create", userAuth, createWastageRecordController);
router.get("/list", userAuth, getWastageRecordsController);
router.delete("/:id", userAuth, deleteWastageRecordController);

export default router;
