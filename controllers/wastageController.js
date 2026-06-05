import connectDB from "../config/db.js";

export const createWastageRecordController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { date, items } = req.body; // items is array of { raw_material_id, quantity, reason }

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Wastage items are required"
      });
    }

    const createdDate = date ? new Date(date) : new Date();

    for (const item of items) {
      const { raw_material_id, quantity, reason } = item;

      if (!raw_material_id || !quantity) {
        throw new Error("raw_material_id and quantity are required for all items");
      }

      // 1. Fetch raw material purchase price & conversion factor to calculate value and convert stock
      const [[rm]] = await conn.execute(
        `SELECT purchase_price, conversion_factor, name FROM raw_materials WHERE id = ? AND branch_id = ?`,
        [raw_material_id, branch_id]
      );

      if (!rm) {
        throw new Error(`Raw material not found for ID ${raw_material_id}`);
      }

      const price = Number(rm.purchase_price || 0);
      const value = Number(quantity) * price;

      // 2. Insert Wastage Record
      if (date) {
        await conn.execute(
          `INSERT INTO wastage_records (raw_material_id, branch_id, quantity, reason, value, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [raw_material_id, branch_id, quantity, reason || "Wastage", value, createdDate]
        );
      } else {
        await conn.execute(
          `INSERT INTO wastage_records (raw_material_id, branch_id, quantity, reason, value)
           VALUES (?, ?, ?, ?, ?)`,
          [raw_material_id, branch_id, quantity, reason || "Wastage", value]
        );
      }

      // Convert quantity from purchase unit to consume unit for stock deduction
      const convertedQuantity = Number(quantity) * Number(rm.conversion_factor || 1);

      // 3. Deduct stock (check if stock entry exists)
      const [[stock]] = await conn.execute(
        `SELECT id FROM raw_material_stock WHERE raw_material_id = ? AND branch_id = ?`,
        [raw_material_id, branch_id]
      );

      if (stock) {
        await conn.execute(
          `UPDATE raw_material_stock
           SET quantity = quantity - ?, last_updated_at = NOW()
           WHERE raw_material_id = ? AND branch_id = ?`,
          [convertedQuantity, raw_material_id, branch_id]
        );
      } else {
        await conn.execute(
          `INSERT INTO raw_material_stock (raw_material_id, branch_id, quantity, last_updated_at)
           VALUES (?, ?, ?, NOW())`,
          [raw_material_id, branch_id, -convertedQuantity]
        );
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Wastage records created and stock updated successfully"
    });

  } catch (error) {
    await conn.rollback();
    console.error("❌ Save Wastage Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create wastage record",
      error: error.message
    });
  } finally {
    conn.release();
  }
};

export const getWastageRecordsController = async (req, res) => {
  try {
    const pool = await connectDB();
    const branch_id = req.user.branch_id;

    const [rows] = await pool.execute(
      `SELECT wr.id, DATE_FORMAT(wr.created_at, '%d-%m-%Y') AS date, 
              rm.category, rm.name AS material, wr.quantity AS qty, 
              u.unit_symbol AS unit, wr.reason, wr.value
       FROM wastage_records wr
       JOIN raw_materials rm ON rm.id = wr.raw_material_id
       JOIN units u ON u.id = rm.purchase_unit_id
       WHERE wr.branch_id = ?
       ORDER BY wr.created_at DESC`,
      [branch_id]
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("❌ Fetch Wastage Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wastage records",
      error: error.message
    });
  }
};

export const deleteWastageRecordController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { id } = req.params;

    // 1. Fetch wastage details and conversion factor
    const [[record]] = await conn.execute(
      `SELECT wr.raw_material_id, wr.quantity, rm.conversion_factor 
       FROM wastage_records wr
       JOIN raw_materials rm ON rm.id = wr.raw_material_id
       WHERE wr.id = ? AND wr.branch_id = ?`,
      [id, branch_id]
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Wastage record not found" });
    }

    const convertedQuantity = Number(record.quantity) * Number(record.conversion_factor || 1);

    // 2. Add quantity back to stock (in consume unit)
    await conn.execute(
      `UPDATE raw_material_stock
       SET quantity = quantity + ?, last_updated_at = NOW()
       WHERE raw_material_id = ? AND branch_id = ?`,
      [convertedQuantity, record.raw_material_id, branch_id]
    );

    // 3. Delete wastage record
    await conn.execute(
      `DELETE FROM wastage_records WHERE id = ? AND branch_id = ?`,
      [id, branch_id]
    );

    await conn.commit();
    res.json({ success: true, message: "Wastage record deleted and stock reverted successfully" });

  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
};
