import express from "express";
import User from "../models/user.models.js";
import Order from "../models/order.models.js"; // 👈 ADD THIS AT TOP


const router = express.Router();

// 🔄 Restore user session + transaction history
router.post("/register", async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Name and phone are required",
      });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        name,
        phone,
        sessionKey: crypto.randomUUID(),
      });
    }

    res.status(201).json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false });
  }
});




export default router;
