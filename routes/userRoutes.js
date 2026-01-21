import express from "express";
import { registerUser, getUsers } from "../controllers/userController.js";
import { addBranch,getMyBranches } from "../controllers/branchController.js";
import superAdminAuth from "../middlewares/authMiddlewares.js";
import userAuth from "../middlewares/userMiddleware.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);
router.get("/list", superAdminAuth, getUsers);

router.post("/create", userAuth, addBranch);
router.get("/branches", userAuth, getMyBranches);

export default router;
