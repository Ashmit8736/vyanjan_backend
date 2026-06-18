import express from "express";
import {
  getAreas,
  createArea,
  updateArea,
  deleteArea,
  getTables,
  createTable,
  updateTable,
  deleteTable
} from "../controllers/diningController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

// Areas routes
router.get("/areas", userAuth, getAreas);
router.post("/areas/create", userAuth, createArea);
router.put("/areas/update/:id", userAuth, updateArea);
router.delete("/areas/delete/:id", userAuth, deleteArea);

// Tables routes
router.get("/tables", userAuth, getTables);
router.post("/tables/create", userAuth, createTable);
router.put("/tables/update/:id", userAuth, updateTable);
router.delete("/tables/delete/:id", userAuth, deleteTable);

export default router;
