import connectDB from "../config/db.js";

/**
 * AREAS MANAGEMENT
 */

// Get all areas for the branch
export const getAreas = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }

    const pool = await connectDB();
    const [rows] = await pool.query(
      "SELECT * FROM areas WHERE branch_id = ? ORDER BY created_at DESC",
      [branch_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching areas:", error);
    res.status(500).json({ success: false, message: "Failed to fetch areas", error: error.message });
  }
};

// Create a new area
export const createArea = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { area_name, description, status } = req.body;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }
    if (!area_name || !area_name.trim()) {
      return res.status(400).json({ success: false, message: "Area name is required" });
    }

    const pool = await connectDB();

    // Check for duplicate area name within the same branch
    const [existing] = await pool.query(
      "SELECT id FROM areas WHERE branch_id = ? AND LOWER(area_name) = LOWER(?) LIMIT 1",
      [branch_id, area_name.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Area name '${area_name}' already exists in this branch` });
    }

    const [result] = await pool.query(
      "INSERT INTO areas (branch_id, area_name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
      [branch_id, area_name.trim(), description || null, status || "active"]
    );

    res.status(201).json({
      success: true,
      message: "Area created successfully",
      data: { id: result.insertId, area_name, description, status: status || "active" }
    });
  } catch (error) {
    console.error("Error creating area:", error);
    res.status(500).json({ success: false, message: "Failed to create area", error: error.message });
  }
};

// Update an area
export const updateArea = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { id } = req.params;
    const { area_name, description, status } = req.body;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }
    if (!area_name || !area_name.trim()) {
      return res.status(400).json({ success: false, message: "Area name is required" });
    }

    const pool = await connectDB();

    // Verify ownership
    const [ownership] = await pool.query(
      "SELECT id FROM areas WHERE id = ? AND branch_id = ? LIMIT 1",
      [id, branch_id]
    );
    if (ownership.length === 0) {
      return res.status(404).json({ success: false, message: "Area not found or access denied" });
    }

    // Check for duplicate name (excluding current ID)
    const [existing] = await pool.query(
      "SELECT id FROM areas WHERE branch_id = ? AND LOWER(area_name) = LOWER(?) AND id != ? LIMIT 1",
      [branch_id, area_name.trim(), id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Another area with the name '${area_name}' already exists` });
    }

    await pool.query(
      "UPDATE areas SET area_name = ?, description = ?, status = ?, updated_at = NOW() WHERE id = ? AND branch_id = ?",
      [area_name.trim(), description || null, status || "active", id, branch_id]
    );

    res.status(200).json({ success: true, message: "Area updated successfully" });
  } catch (error) {
    console.error("Error updating area:", error);
    res.status(500).json({ success: false, message: "Failed to update area", error: error.message });
  }
};

// Delete an area
export const deleteArea = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { id } = req.params;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }

    const pool = await connectDB();

    // Verify ownership
    const [ownership] = await pool.query(
      "SELECT id FROM areas WHERE id = ? AND branch_id = ? LIMIT 1",
      [id, branch_id]
    );
    if (ownership.length === 0) {
      return res.status(404).json({ success: false, message: "Area not found or access denied" });
    }

    // Check if there are tables linked to this area
    const [tables] = await pool.query(
      "SELECT id FROM tables WHERE area_id = ? LIMIT 1",
      [id]
    );
    if (tables.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete area. Please delete or move all tables associated with this area first."
      });
    }

    await pool.query("DELETE FROM areas WHERE id = ? AND branch_id = ?", [id, branch_id]);

    res.status(200).json({ success: true, message: "Area deleted successfully" });
  } catch (error) {
    console.error("Error deleting area:", error);
    res.status(500).json({ success: false, message: "Failed to delete area", error: error.message });
  }
};


/**
 * TABLES MANAGEMENT
 */

// Get all tables for the branch
export const getTables = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }

    const pool = await connectDB();
    const [rows] = await pool.query(
      `SELECT t.*, a.area_name,
              i.id AS active_invoice_id,
              i.invoice_number AS active_invoice_number,
              i.kot_number AS active_invoice_kot,
              i.total_amount AS active_invoice_amount,
              i.status AS active_invoice_status,
              i.created_at AS active_invoice_created_at
       FROM tables t
       INNER JOIN areas a ON t.area_id = a.id
       LEFT JOIN invoices i ON t.id = i.table_id
         AND i.id = (
           SELECT inv.id FROM invoices inv
           WHERE inv.table_id = t.id AND inv.status IN ('running', 'printed', 'running_kot', 'paid')
           ORDER BY inv.created_at DESC
           LIMIT 1
         )
       WHERE a.branch_id = ?
       ORDER BY a.area_name ASC, CAST(t.table_number AS UNSIGNED) ASC, t.table_number ASC`,
      [branch_id]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ success: false, message: "Failed to fetch tables", error: error.message });
  }
};

// Create a new table
export const createTable = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { area_id, table_number, table_name, capacity, status, notes } = req.body;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }
    if (!area_id) {
      return res.status(400).json({ success: false, message: "Area ID is required" });
    }
    if (!table_number || !table_number.trim()) {
      return res.status(400).json({ success: false, message: "Table number is required" });
    }

    const pool = await connectDB();

    // Verify that the target area belongs to the same branch
    const [areaCheck] = await pool.query(
      "SELECT id FROM areas WHERE id = ? AND branch_id = ? LIMIT 1",
      [area_id, branch_id]
    );
    if (areaCheck.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid Area ID. Area does not exist or belong to this branch" });
    }

    // Check for duplicate table number within the same area
    const [existing] = await pool.query(
      "SELECT id FROM tables WHERE area_id = ? AND LOWER(table_number) = LOWER(?) LIMIT 1",
      [area_id, table_number.trim()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `Table number '${table_number}' already exists in this area` });
    }

    const [result] = await pool.query(
      `INSERT INTO tables (area_id, table_number, table_name, capacity, status, current_guest_count, notes, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
      [
        area_id,
        table_number.trim(),
        table_name ? table_name.trim() : `Table ${table_number.trim()}`,
        capacity || 4,
        status || "available",
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Table created successfully",
      data: { id: result.insertId, area_id, table_number, table_name }
    });
  } catch (error) {
    console.error("Error creating table:", error);
    res.status(500).json({ success: false, message: "Failed to create table", error: error.message });
  }
};

// Update a table
export const updateTable = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { id } = req.params;
    const { area_id, table_number, table_name, capacity, status, notes } = req.body;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }
    if (!area_id) {
      return res.status(400).json({ success: false, message: "Area ID is required" });
    }
    if (!table_number || !table_number.trim()) {
      return res.status(400).json({ success: false, message: "Table number is required" });
    }

    const pool = await connectDB();

    // Verify that the table belongs to the user's branch
    const [tableOwnership] = await pool.query(
      `SELECT t.id FROM tables t
       INNER JOIN areas a ON t.area_id = a.id
       WHERE t.id = ? AND a.branch_id = ? LIMIT 1`,
      [id, branch_id]
    );
    if (tableOwnership.length === 0) {
      return res.status(404).json({ success: false, message: "Table not found or access denied" });
    }

    // Verify that the target area belongs to the user's branch
    const [areaCheck] = await pool.query(
      "SELECT id FROM areas WHERE id = ? AND branch_id = ? LIMIT 1",
      [area_id, branch_id]
    );
    if (areaCheck.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid Area ID. Area does not exist or belong to this branch" });
    }

    // Check for duplicate table number within the same area (excluding current table)
    const [duplicateCheck] = await pool.query(
      "SELECT id FROM tables WHERE area_id = ? AND LOWER(table_number) = LOWER(?) AND id != ? LIMIT 1",
      [area_id, table_number.trim(), id]
    );
    if (duplicateCheck.length > 0) {
      return res.status(400).json({ success: false, message: `Another table with number '${table_number}' already exists in this area` });
    }

    await pool.query(
      `UPDATE tables 
       SET area_id = ?, table_number = ?, table_name = ?, capacity = ?, status = ?, notes = ?, updated_at = NOW() 
       WHERE id = ?`,
      [
        area_id,
        table_number.trim(),
        table_name ? table_name.trim() : `Table ${table_number.trim()}`,
        capacity || 4,
        status || "available",
        notes || null,
        id
      ]
    );

    res.status(200).json({ success: true, message: "Table updated successfully" });
  } catch (error) {
    console.error("Error updating table:", error);
    res.status(500).json({ success: false, message: "Failed to update table", error: error.message });
  }
};

// Delete a table
export const deleteTable = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { id } = req.params;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: "Branch ID is missing from user session" });
    }

    const pool = await connectDB();

    // Verify that the table belongs to the user's branch
    const [tableOwnership] = await pool.query(
      `SELECT t.id FROM tables t
       INNER JOIN areas a ON t.area_id = a.id
       WHERE t.id = ? AND a.branch_id = ? LIMIT 1`,
      [id, branch_id]
    );
    if (tableOwnership.length === 0) {
      return res.status(404).json({ success: false, message: "Table not found or access denied" });
    }

    await pool.query("DELETE FROM tables WHERE id = ?", [id]);

    res.status(200).json({ success: true, message: "Table deleted successfully" });
  } catch (error) {
    console.error("Error deleting table:", error);
    res.status(500).json({ success: false, message: "Failed to delete table", error: error.message });
  }
};
