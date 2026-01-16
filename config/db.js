import mysql from "mysql2/promise";

const connectDB = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log("✅ MariaDB Connected Successfully");
    return connection;

  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
