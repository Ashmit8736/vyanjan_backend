import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const conn = await pool.getConnection();
    const branch_id = 1; // Assuming branch_id 1
    const raw_material_id = 2; // Assuming raw_material_id 2 (Aloo)

    console.log("=== STOCK BEFORE ===");
    const [stockBefore] = await conn.execute(
      "SELECT * FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?",
      [raw_material_id, branch_id]
    );
    console.log(stockBefore);

    // Simulate wastage insert & stock deduction
    console.log("\n=== SAVING WASTAGE ENTRY ===");
    const quantity = 5.0; // 5 kg
    const reason = "Expired Aloo";

    // 1. Fetch raw material details
    const [[rm]] = await conn.execute(
      `SELECT purchase_price, name FROM raw_materials WHERE id = ? AND branch_id = ?`,
      [raw_material_id, branch_id]
    );
    console.log("Raw material details fetched:", rm);

    if (!rm) {
      throw new Error("Raw material not found");
    }

    const price = Number(rm.purchase_price || 0);
    const value = quantity * price;

    // Start transaction
    await conn.beginTransaction();

    // 2. Insert wastage record
    const [result] = await conn.execute(
      `INSERT INTO wastage_records (raw_material_id, branch_id, quantity, reason, value)
       VALUES (?, ?, ?, ?, ?)`,
      [raw_material_id, branch_id, quantity, reason, value]
    );
    console.log("Wastage record inserted, ID:", result.insertId);

    // 3. Deduct stock
    const [[stock]] = await conn.execute(
      `SELECT id, quantity FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?`,
      [raw_material_id, branch_id]
    );
    console.log("Stock row checked:", stock);

    if (stock) {
      const [updateResult] = await conn.execute(
        `UPDATE raw_material_stock
         SET quantity = quantity - ?, last_updated_at = NOW()
         WHERE raw_material_id = ? AND branch_id = ?`,
        [quantity, raw_material_id, branch_id]
      );
      console.log("Stock updated, affectedRows:", updateResult.affectedRows);
    } else {
      const [insertResult] = await conn.execute(
        `INSERT INTO raw_material_stock (raw_material_id, branch_id, quantity, last_updated_at)
         VALUES (?, ?, ?, NOW())`,
        [raw_material_id, branch_id, -quantity]
      );
      console.log("Stock inserted, affectedRows:", insertResult.affectedRows);
    }

    await conn.commit();
    console.log("Transaction committed successfully!");

    console.log("\n=== STOCK AFTER ===");
    const [stockAfter] = await conn.execute(
      "SELECT * FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?",
      [raw_material_id, branch_id]
    );
    console.log(stockAfter);

    conn.release();
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  } finally {
    await pool.end();
  }
};

run();
