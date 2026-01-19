import express from "express";
import { registerUser, getUsers } from "../controllers/userController.js";
import superAdminAuth from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);
router.get("/list", superAdminAuth, getUsers);

export default router;
