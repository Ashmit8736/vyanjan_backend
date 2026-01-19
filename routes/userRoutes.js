import express from "express";
import { registerUser, getAllUsers} from "../controllers/userController.js";
import superAdminAuth from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);

router.get("/users", superAdminAuth, getAllUsers);

export default router;
