import express from "express";
import { registerUser} from "../controllers/userController.js";
import superAdminAuth from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/signup", superAdminAuth, registerUser);

export default router;
