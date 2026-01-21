import connectDB from "../config/db.js";
import {
  getBranchCountByUser,
  createBranch,
  getBranchesByUser
} from "../models/branchModel.js";

export const addBranch = async (req, res) => {
  try {
    const db = await connectDB();
    const userId = req.user.id;

    const {
      branch_name,
      license_no,
      gst_no,
      email,
      address,
      city,
      state,
      pincode,
      primary_no,
      secondary_no
    } = req.body;

    // store_count
    const [userRows] = await db.query(
      "SELECT store_count FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const storeCount = userRows[0].store_count;

    // branch count (SP)
    const branchCount = await getBranchCountByUser(userId);

    if (branchCount >= storeCount) {
      return res.status(400).json({
        message: "Branch limit exceeded"
      });
    }

    // create branch (SP)
    await createBranch([
      userId,
      userId,
      branch_name,
      license_no,
      gst_no,
      email,
      address,
      city,
      state,
      pincode,
      primary_no,
      secondary_no
    ]);

    res.status(201).json({
      message: "Branch created successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ GET branches API
export const getMyBranches = async (req, res) => {
  try {
    const userId = req.user.id;

    const branches = await getBranchesByUser(userId);

    res.status(200).json({
      success: true,
      total: branches.length,
      data: branches
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
