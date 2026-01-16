import connectDB from "../config/db.js";

export const createSuperAdmin = async (name, email, password) => {
  const db = await connectDB();

  await db.execute(
    "CALL CreateSuperAdmin(?,?,?)",
    [name, email, password]
  );
};

export const findSuperAdminByEmail = async (email) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "CALL GetSuperAdminByEmail(?)",
    [email]
  );

  if (!rows || !rows[0] || rows[0].length === 0) return null;

  return rows[0][0];
};
