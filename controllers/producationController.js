import { createProduction, getProductionByBranch } from "../models/producationModel.js";

export const executeProduction = async (req, res) => {
  try {
    const production_id = await createProduction(req.body);

    res.status(201).json({
      message: "Production completed successfully",
      production_id
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
};


export const listProduction = async (req, res) => {
  try {
    // const { branch_id } = req.query;
        const branch_id = req.user.branch_id; 

    if (!branch_id) {
      return res.status(400).json({
        error: "branch_id is required"
      });
    }

    const data = await getProductionByBranch(branch_id);
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
