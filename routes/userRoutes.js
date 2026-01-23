import express from "express";
import { registerUser, getUsers, getUserBranchStats, addBranchUser, getBranchUsers , getOwnerUsers} from "../controllers/userController.js";
import superAdminAuth, { userAuth1 } from "../middlewares/authMiddlewares.js";
import {addBranch, getMyBranches } from "../controllers/branchController.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);
router.get("/list", superAdminAuth, getUsers);
router.get("/branch-stats", userAuth, getUserBranchStats);

router.post("/create", userAuth , addBranch );
router.get("/branches", userAuth , getMyBranches);


router.post("/branchUser", userAuth, addBranchUser);

router.get("/branch/:branchId", userAuth, getBranchUsers);


router.get("/owner/users", userAuth, getOwnerUsers);
export default router;
