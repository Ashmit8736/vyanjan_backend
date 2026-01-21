import express from "express";
import { registerUser, getUsers, getUserBranchStats } from "../controllers/userController.js";
import superAdminAuth, { userAuth1 } from "../middlewares/authMiddlewares.js";
import {addBranch, getMyBranches } from "../controllers/branchController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);
router.get("/list", superAdminAuth, getUsers);
router.get("/branch-stats", userAuth1, getUserBranchStats);

router.post("/create", userAuth , addBranch );
router.get("/branches", userAuth , getMyBranches);

export default router;
