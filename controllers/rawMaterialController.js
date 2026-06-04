import RawMaterialModel from "../models/rawMaterialModel.js";

export const createRawMaterial = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    const result = await RawMaterialModel.create({
      branch_id,
      ...req.body
    });

    res.status(201).json({
      success: true,
      message: "Raw material created successfully",
      raw_material_id: result.insertId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Raw material create nahi ho paya",
      error: error.message
    });
  }
};

export const getRawMaterials = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;

    const data = await RawMaterialModel.getAllByBranch(branch_id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Raw materials fetch nahi ho paye",
      error: error.message
    });
  }
};

export const updateRawMaterial = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { id } = req.params;

    const result = await RawMaterialModel.update(id, branch_id, req.body);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found or unauthorized"
      });
    }

    res.status(200).json({
      success: true,
      message: "Raw material updated successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Raw material update failed",
      error: error.message
    });
  }
};

export const getRawMaterialLogs = async (req, res) => {
  try {
    const branch_id = req.user.branch_id;
    const { id } = req.params;

    const data = await RawMaterialModel.getLogs(id, branch_id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch raw material logs",
      error: error.message
    });
  }
};
