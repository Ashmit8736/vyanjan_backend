import connectDB from "../config/db.js";

export const createItemWastageRecordController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { date, items } = req.body; // items is array of { item_id, quantity, reason }

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Wastage items are required"
      });
    }

    const createdDate = date ? new Date(date) : new Date();

    for (const item of items) {
      const { item_id, quantity, reason } = item;

      if (!item_id || !quantity) {
        throw new Error("item_id and quantity are required for all items");
      }

      // 1. Fetch item details (selling price to compute value if needed, and remaining_qty)
      const [[dbItem]] = await conn.execute(
        `SELECT selling_price, remaining_qty, name FROM items WHERE id = ? AND branch_id = ?`,
        [item_id, branch_id]
      );

      if (!dbItem) {
        throw new Error(`Item not found for ID ${item_id}`);
      }

      const price = Number(dbItem.selling_price || 0);
      const value = Number(quantity) * price;

      // 2. Insert Wastage Record
      await conn.execute(
        `INSERT INTO item_wastage_records (item_id, branch_id, quantity, reason, value, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item_id, branch_id, quantity, reason || "Wastage", value, createdDate]
      );

      // 3. Deduct stock from items table
      const newQty = Number(dbItem.remaining_qty) - Number(quantity);
      let stock_status = "In Stock";
      if (newQty <= 0) {
        stock_status = "Out of Stock";
      }

      await conn.execute(
        `UPDATE items
         SET remaining_qty = ?, stock_status = ?
         WHERE id = ? AND branch_id = ?`,
        [newQty, stock_status, item_id, branch_id]
      );

      // 4. Deduct from Received vouchers of this item (FIFO)
      let quantityToDeduct = Number(quantity);
      const [vouchersList] = await conn.execute(
        `SELECT id, remaining_quantity FROM vouchers
         WHERE branch_id = ? AND item_name = ? AND status = 'Received' AND remaining_quantity > 0
         ORDER BY received_at ASC, id ASC`,
        [branch_id, dbItem.name]
      );

      for (const voucher of vouchersList) {
        if (quantityToDeduct <= 0) break;

        const remQty = Number(voucher.remaining_quantity);
        if (remQty >= quantityToDeduct) {
          await conn.execute(
            `UPDATE vouchers SET remaining_quantity = remaining_quantity - ? WHERE id = ?`,
            [quantityToDeduct, voucher.id]
          );
          quantityToDeduct = 0;
        } else {
          await conn.execute(
            `UPDATE vouchers SET remaining_quantity = 0 WHERE id = ?`,
            [voucher.id]
          );
          quantityToDeduct -= remQty;
        }
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Item wastage records created and stock updated successfully"
    });

  } catch (error) {
    await conn.rollback();
    console.error("❌ Save Item Wastage Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create item wastage record",
      error: error.message
    });
  } finally {
    conn.release();
  }
};

export const getItemWastageRecordsController = async (req, res) => {
  try {
    const pool = await connectDB();
    const branch_id = req.user.branch_id;

    const [rows] = await pool.execute(
      `SELECT wr.id, DATE_FORMAT(wr.created_at, '%Y-%m-%d') AS date, 
              i.category, i.name AS item, wr.quantity AS qty, 
              wr.reason, wr.value, i.id as item_id
       FROM item_wastage_records wr
       JOIN items i ON i.id = wr.item_id
       WHERE wr.branch_id = ?
       ORDER BY wr.created_at DESC`,
      [branch_id]
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("❌ Fetch Item Wastage Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item wastage records",
      error: error.message
    });
  }
};

export const deleteItemWastageRecordController = async (req, res) => {
  const pool = await connectDB();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const branch_id = req.user.branch_id;
    const { id } = req.params;

    // 1. Fetch wastage details
    const [[record]] = await conn.execute(
      `SELECT wr.item_id, wr.quantity 
       FROM item_wastage_records wr
       WHERE wr.id = ? AND wr.branch_id = ?`,
      [id, branch_id]
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Item wastage record not found" });
    }

    const { item_id, quantity } = record;

    // 2. Add quantity back to stock
    const [[dbItem]] = await conn.execute(
      `SELECT remaining_qty, name FROM items WHERE id = ? AND branch_id = ?`,
      [item_id, branch_id]
    );

    if (dbItem) {
      const newQty = Number(dbItem.remaining_qty) + Number(quantity);
      let stock_status = "In Stock";
      if (newQty <= 0) {
        stock_status = "Out of Stock";
      }

      await conn.execute(
        `UPDATE items
         SET remaining_qty = ?, stock_status = ?
         WHERE id = ? AND branch_id = ?`,
        [newQty, stock_status, item_id, branch_id]
      );

      // 3. Add back to vouchers (Latest Received voucher)
      const [[latestVoucher]] = await conn.execute(
        `SELECT id FROM vouchers
         WHERE branch_id = ? AND item_name = ? AND status = 'Received'
         ORDER BY id DESC LIMIT 1`,
        [branch_id, dbItem.name]
      );
      
      if (latestVoucher) {
        await conn.execute(
          `UPDATE vouchers SET remaining_quantity = remaining_quantity + ? WHERE id = ?`,
          [quantity, latestVoucher.id]
        );
      }
    }

    // 3. Delete wastage record
    await conn.execute(
      `DELETE FROM item_wastage_records WHERE id = ? AND branch_id = ?`,
      [id, branch_id]
    );

    await conn.commit();
    res.json({ success: true, message: "Item wastage record deleted and stock reverted successfully" });

  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
};
