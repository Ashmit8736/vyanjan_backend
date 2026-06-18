import UnitModel from "../models/unitModel.js";

export const getUnits = async (req, res) => {
  try {
    const units = await UnitModel.getAll();
    res.status(200).json({
      success: true,
      data: units
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Units fetch nahi ho paye",
      error: error.message
    });
  }
};

export const createUnit = async (req, res) => {
  try {
    const { unit_name, unit_symbol } = req.body;

    if (!unit_name || !unit_symbol) {
      return res.status(400).json({
        success: false,
        message: "unit_name aur unit_symbol required hai"
      });
    }

    const result = await UnitModel.create({ unit_name, unit_symbol });

    res.status(201).json({
      success: true,
      message: "Unit created successfully",
      unit_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unit create nahi ho payi",
      error: error.message
    });
  }
};

export const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_name, unit_symbol } = req.body;

    if (!unit_name || !unit_symbol) {
      return res.status(400).json({
        success: false,
        message: "unit_name aur unit_symbol required hai"
      });
    }

    const result = await UnitModel.update(id, { unit_name, unit_symbol });

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Unit updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unit update nahi ho payi",
      error: error.message
    });
  }
};

export const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await UnitModel.delete(id);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Unit deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unit delete nahi ho payi",
      error: error.message
    });
  }
};
