// import db from "../config/db.js";

// const UnitModel = {
//   // 👉 Create Unit
//   create: (data, callback) => {
//     const sql = `
//       INSERT INTO units (unit_name, unit_symbol)
//       VALUES (?, ?)
//     `;
//     db.query(sql, [data.unit_name, data.unit_symbol], callback);
//   },

//   // 👉 Get All Units
//   getAll: (callback) => {
//     const sql = `
//       SELECT id, unit_name, unit_symbol
//       FROM units
//       WHERE is_active = 1
//       ORDER BY unit_name ASC
//     `;
//     db.query(sql, callback);
//   }
// };

// export default UnitModel;


// import db from "../config/db.js";

// const UnitModel = {

//   getAll: async () => {
//     const sql = `
//       SELECT id, unit_name, unit_symbol
//       FROM units
//       WHERE is_active = 1
//       ORDER BY unit_name ASC
//     `;
//     const [rows] = await db.execute(sql);
//     return rows;
//   },

//   create: async (data) => {
//     const sql = `
//       INSERT INTO units (unit_name, unit_symbol)
//       VALUES (?, ?)
//     `;
//     const [result] = await db.execute(sql, [
//       data.unit_name,
//       data.unit_symbol
//     ]);
//     return result;
//   }
// };

// export default UnitModel;


import connectDB from "../config/db.js";

const UnitModel = {

  getAll: async () => {
    const db = await connectDB();

    const sql = `
      SELECT id, unit_name, unit_symbol
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
