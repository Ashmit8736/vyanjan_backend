import connectDB from "../config/db.js";

export const findSubscriptionByName = async (name) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "CALL GetSubscriptionByName(?)",
    [name]
  );

  if (!rows || !rows[0] || rows[0].length === 0) return null;
  return rows[0][0];
};

export const createUser = async (data) => {
  const db = await connectDB();

  await db.execute(
    "CALL CreateUser(?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      data.name,
      data.email,
      data.phone,
      data.password,
      data.store_count,
      data.gst_number,
      data.shop_name,
      data.address,
      data.district,
      data.state,
      data.pincode,
      data.subscription_id
    ]
  );
};

export const findUserByEmailOrPhone = async (email, phone) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1",
    [email, phone]
  );

  return rows.length ? rows[0] : null;
};

export const getAllUsers = async (page = 1, limit = 6) => {
  const db = await connectDB();

  // Execute the stored procedure
  // Note: execute returns [rows, fields]. 
  // Since we have multiple SELECT statements in SP (data + count), rows will be an array of result sets.
  const [results] = await db.execute("CALL GetExistingCustomers(?, ?)", [page, limit]);

  // results[0] is the user list
  // results[1] is the total count
  return {
    users: results[0],
    total: results[1][0].total_count
  };
};


export const findUserByIdentifier = async (identifier) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "CALL get_branch_count(?)",
    [identifier]
  );

  return rows[0][0] || null;
};

export const getUsersPaginated = async (limit, offset) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "CALL GetUsersPaginated(?,?)",
    [limit, offset]
  );

  return rows[0]; // SP result
};

export const getUsersCount = async () => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "CALL GetUsersCount()"
  );

  return rows[0][0].total;
};

export const findUserById = async (id) => {
  const db = await connectDB();

  // Fetch store_count and calculate created_branches_count in one go
  const [rows] = await db.execute(
    `SELECT store_count, (SELECT COUNT(*) FROM branch WHERE user_id = ?) as created_branches_count FROM users WHERE id = ?`,
    [id, id]
  );

  return rows.length ? rows[0] : null;
};



export const createBranchUser = async (data) => {
  const db = await connectDB();
  await db.query(
    "CALL CreateBranchUser(?,?,?,?,?,?,?,?)",
    data
  );
};

export const getUsersByBranch = async (branchId) => {
  const db = await connectDB();
  const [rows] = await db.query(
    "CALL GetUsersByBranch(?)",
    [branchId]
  );

  // mysql2 SP result structure
  return rows[0];
};






export const findUserForLogin = async (email) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    `SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.password,
        u.role,
        u.branch_id,
        u.is_active,

        b.branch_name,
        b.gst_no
     FROM users u
     LEFT JOIN branch b ON b.branch_id = u.branch_id
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );

  return rows.length ? rows[0] : null;
};



export const getUsersCreatedByOwner = async (ownerId) => {
  const db = await connectDB();   // 🔥 THIS WAS MISSING

  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.is_active,
      b.branch_name
    FROM users u
    JOIN branch b ON b.branch_id = u.branch_id
    WHERE 
      u.created_by = ?
      AND u.role IN ('inventory', 'billing', 'both')
    ORDER BY u.created_at DESC
  `;

  const [rows] = await db.query(query, [ownerId]);
  return rows;
};
