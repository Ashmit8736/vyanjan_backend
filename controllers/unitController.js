// import UnitModel from "../models/unitModel.js";

// const UnitController = {

//   // ✅ POST /units
//   createUnit: (req, res) => {
//     const { unit_name, unit_symbol } = req.body;

//     if (!unit_name || !unit_symbol) {
//       return res.status(400).json({
//         success: false,
//         message: "unit_name aur unit_symbol required hai"
//       });
//     }

//     UnitModel.create({ unit_name, unit_symbol }, (err, result) => {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: "Unit create nahi ho payi",
//           error: err
//         });
//       }

//       res.status(201).json({
//         success: true,
//         message: "Unit successfully created",
//         unit_id: result.insertId
//       });
//     });
//   },

//   // ✅ GET /units
//   getUnits: (req, res) => {
//     UnitModel.getAll((err, results) => {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: "Units fetch nahi ho paye",
//           error: err
//         });
//       }

//       res.status(200).json({
//         success: true,
//         data: results
//       });
//     });
//   }
// };

// export default UnitController;



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
