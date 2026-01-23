import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findSuperAdminByEmail } from "../models/superadminModel.js";
import { findUserByIdentifier, findUserForLogin } from "../models/userModel.js";

export const unifiedLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // 🔹 1. Super Admin check
    const superAdmin = await findSuperAdminByEmail(email);

    if (superAdmin) {
      const isMatch = await bcrypt.compare(password, superAdmin.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: superAdmin.id, role: "SUPER_ADMIN" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      return res.json({
        success: true,
        role: "SUPER_ADMIN",
        token,
        user: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email
        }
      });
    }

    // 🔹 2. Normal User check
    // const user = await findUserByIdentifier(email);
    const user = await  findUserForLogin(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "User account inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role ,  branch_id: user.branch_id || null},
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      role: user.role,
      // role: "USER",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        shop_name: user.shop_name,
        branch_id: user.branch_id,
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
