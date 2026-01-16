import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.send("✅ PetPooja Backend is Running");
});

export default router;
