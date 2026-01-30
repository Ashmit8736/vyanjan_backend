import connectDB from "../config/db.js";

/**
 * CREATE SUPPLIER (BRANCH WISE)
 */
export const createSupplier = async (data) => {
  const db = await connectDB();

  await db.query(
    `INSERT INTO suppliers
    (branch_id, name, company_name, email, phone,
     billing_address, billing_state, billing_city, billing_pincode,
     shipping_address, shipping_state, shipping_city, shipping_pincode,
     gst_number, pan, fssai_license, msme_number, tan, cin,
     tcs_applicable, tcs_type, tcs_percentage)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    data
  );

  return true;
};

/**
 * GET SUPPLIERS BY BRANCH
 */
export const getSuppliersByBranch = async (branchId) => {
  const db = await connectDB();

  const [rows] = await db.query(
    `SELECT *
     FROM suppliers
     WHERE branch_id = ? AND is_active = 1
     ORDER BY created_at DESC`,
    [branchId]
  );

  return rows;
};

/**
 * GET SUPPLIER BY ID (BRANCH SAFE)
 */
export const getSupplierById = async (id, branchId) => {
  const db = await connectDB();

  const [rows] = await db.query(
    `SELECT *
     FROM suppliers
     WHERE id = ? AND branch_id = ? AND is_active = 1`,
    [id, branchId]
  );

  return rows[0];
};

/**
 * SOFT DELETE SUPPLIER (BRANCH SAFE)
 */
export const deleteSupplier = async (id, branchId) => {
  const db = await connectDB();

  await db.query(
    `UPDATE suppliers
     SET is_active = 0
     WHERE id = ? AND branch_id = ?`,
    [id, branchId]
  );

  return true;
};
