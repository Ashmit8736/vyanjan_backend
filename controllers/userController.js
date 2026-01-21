import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmailOrPhone,
  findSubscriptionByName,
  findUserByIdentifier,
  getAllUsers
} from "../models/userModel.js";

export const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      gst_number,
      shop_name,
      address,
      district,
      state,
      pincode,
      subscription_name,
      store_count  
    } = req.body;

    if (!name || !email || !phone || !password || !shop_name || !address || !district || !state || !pincode || !subscription_name) {
      return res.status(400).json({ message: "All required fields missing" });
    }

    const exists = await findUserByEmailOrPhone(email, phone);
    if (exists) {
      return res.status(409).json({ message: "Email or phone already exists" });
    }

    const subscription = await findSubscriptionByName(subscription_name);
    if (!subscription) {
      return res.status(400).json({ message: "Invalid subscription plan" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await createUser({
      name,
      email,
      phone,
      password: hashedPassword,
       store_count: store_count || 1,
      gst_number: gst_number || null,
      shop_name,
      address,
      district,
      state,
      pincode,
      subscription_id: subscription.id
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // identifier = email OR phone
    if (!email || !password) {
      return res.status(400).json({ message: "Email/Phone and password required" });
    }

    const user = await findUserByIdentifier(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "User account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: "USER"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;

    const { users, total } = await getAllUsers(page, limit);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

