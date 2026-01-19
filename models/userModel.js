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
    "CALL CreateUser(?,?,?,?,?,?,?,?,?,?,?)",
    [
      data.name,
      data.email,
      data.phone,
      data.password,
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


export const findUserByIdentifier = async (identifier) => {
  const db = await connectDB();

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1",
    [identifier, identifier]
  );

  return rows.length ? rows[0] : null;
};