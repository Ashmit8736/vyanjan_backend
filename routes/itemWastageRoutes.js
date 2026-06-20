import express from "express";
import {
  createItemWastageRecordController,
  getItemWastageRecordsController,
  deleteItemWastageRecordController
} from "../controllers/itemWastageController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/create", userAuth, createItemWastageRecordController);
router.get("/list", userAuth, getItemWastageRecordsController);
router.delete("/:id", userAuth, deleteItemWastageRecordController);

export default router;
