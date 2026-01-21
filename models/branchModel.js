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

  const [rows] = await db.query(
    "SELECT * FROM branch WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );

  return rows;
};
