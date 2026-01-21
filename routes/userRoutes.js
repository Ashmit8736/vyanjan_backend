import express from "express";
import { registerUser, getUsers, getUserBranchStats } from "../controllers/userController.js";
import superAdminAuth, { userAuth } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);
router.get("/list", superAdminAuth, getUsers);
router.get("/branch-stats", userAuth, getUserBranchStats);

export default router;
