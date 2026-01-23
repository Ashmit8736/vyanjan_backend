import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmailOrPhone,
  findSubscriptionByName,
  findUserByIdentifier,
  getAllUsers,
  findUserById,
  createBranchUser,
  getUsersByBranch,
  getUsersCreatedByOwner
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
        phone: user.phone,
         branch_id: user.branch_id ,
        store_count: user.store_count,
        created_branches_count: user.created_branches_count
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

export const getUserBranchStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await findUserById(userId);

    if (!stats) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      store_count: stats.store_count,
      created_branches_count: stats.created_branches_count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};





// ✅ Create user under a branch
export const addBranchUser = async (req, res) => {
  try {
    const ownerId = req.user.id;
    // const ownerRole = req.user.role;

    // 🔐 Only owner allowed
    // if (ownerRole !== "owner") {
    //   return res.status(403).json({
    //     message: "Only owner can create branch users"
    //   });
    // }

    const {
      name,
      email,
      phone,
      password,
      branch_id,
      role
    } = req.body;

    if (!["billing", "inventory", "both"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    // 🔑 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    await createBranchUser([
      name,
      email,
      phone,
      hashedPassword,
      branch_id,
      ownerId,     // created_by
      role,
      1            // is_active
    ]);

    res.status(201).json({
      message: "Branch user created successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get users of a branch
export const getBranchUsers = async (req, res) => {
  try {
    const branchId = req.params.branchId;

    const users = await getUsersByBranch(branchId);

    res.status(200).json({
      success: true,
      total: users.length,
      data: users
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const getOwnerUsers = async (req, res) => {
  try {
    const ownerId = req.user.id; // auth middleware se

    const users = await getUsersCreatedByOwner(ownerId);

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};