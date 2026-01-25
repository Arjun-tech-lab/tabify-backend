import express from "express";
import crypto from "crypto";
import User from "../models/user.models.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, phone, role = "customer" } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: "Name and phone are required",
      });
    }

    // 🔒 Allow ONLY ONE owner
    if (role === "owner") {
      const existingOwner = await User.findOne({ role: "owner" });
      if (existingOwner) {
        return res.status(403).json({
          success: false,
          error: "Owner already exists",
        });
      }
    }

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        name,
        phone,
        role,
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
