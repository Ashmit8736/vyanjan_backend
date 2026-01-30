import connectDB from "../config/db.js";

const UnitModel = {

  getAll: async () => {
    const db = await connectDB();

    const sql = `
      SELECT id, unit_name, unit_symbol, created_at
      FROM units
      WHERE is_active = 1
      ORDER BY unit_name ASC
    `;

    const [rows] = await db.execute(sql);
    return rows;
  },

  create: async (data) => {
    const db = await connectDB();

    const sql = `
      INSERT INTO units (unit_name, unit_symbol)
      VALUES (?, ?)
    `;

    const [result] = await db.execute(sql, [
      data.unit_name,
      data.unit_symbol
    ]);

    return result;
  }
};

export default UnitModel;
