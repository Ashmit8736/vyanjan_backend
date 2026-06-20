import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const createTable = async () => {
  try {
    const pool = await connectDB();
    const conn = await pool.getConnection();
    
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS item_wastage_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        branch_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        reason VARCHAR(255) DEFAULT 'Wastage',
        value DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      )
    `);
    
    console.log("Table item_wastage_records created successfully");
    conn.release();
    process.exit(0);
  } catch (error) {
    console.error("Error creating table:", error);
    process.exit(1);
  }
};

createTable();
