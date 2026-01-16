import express from "express";
import {
  registerSuperAdmin,
  loginSuperAdmin
} from "../controllers/superadminControllers.js";
import superAdminAuth from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/super-admin/register", registerSuperAdmin);
router.post("/super-admin/login", loginSuperAdmin);

router.get("/super-admin", superAdminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.superAdmin
  });
});

export default router;
