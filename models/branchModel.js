import connectDB from "../config/db.js";

export const getBranchCountByUser = async (userId) => {
  const db = await connectDB();

  const [rows] = await db.query(
    "CALL GetBranchCountByUser(?)",
    [userId]
  );

  // mysql2 SP result format
  return rows[0][0].total;
};

export const createBranch = async (data) => {
  const db = await connectDB();

  await db.query(
    "CALL CreateBranch(?,?,?,?,?,?,?,?,?,?,?,?)",
    data
  );

  return true;
};

export const getBranchesByUser = async (userId) => {
  const db = await connectDB();

  // Check if user is a branch user (has a branch_id and created_by)
  const [userRows] = await db.query("SELECT branch_id, created_by FROM users WHERE id = ?", [userId]);
  let ownerId = userId;
  if (userRows.length > 0 && userRows[0].branch_id !== null && userRows[0].created_by !== null) {
    ownerId = userRows[0].created_by;
  }

  const [rows] = await db.query(
    "SELECT * FROM branch WHERE user_id = ? ORDER BY created_at DESC",
    [ownerId]
  );

  return rows;
};
