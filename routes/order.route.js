import express from "express";
import Order from "../models/order.models.js";
import User from "../models/user.models.js";

const router = express.Router();

// ===============================
// 🧾 CREATE ORDER (Customer ONLY)
// ===============================
router.post("/create", async (req, res) => {
  try {
    const { sessionKey, items, totalAmount } = req.body;

    // 🔐 Validate customer
    const customer = await User.findOne({ sessionKey });
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Invalid session",
      });
    }

    // ✅ Create order
    const order = await Order.create({
      user: customer._id,
      userName: customer.name,
      phone: customer.phone,
      items,
      totalAmount,
    });

    // 🔔 Notify all owners (LIVE REQUESTS)
    const io = req.app.get("io");
    if (io) {
      io.to("owners").emit("newOrder", order);
      console.log("📢 New order sent to owners:", order._id);
    }

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

// ===============================
// 🧾 CUSTOMER: GET MY ORDERS
// ===============================
router.get("/my", async (req, res) => {
  try {
    const sessionKey = req.headers.authorization;

    if (!sessionKey) {
      return res.status(401).json({
        success: false,
        message: "No session key",
      });
    }

    const customer = await User.findOne({ sessionKey });
    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid session",
      });
    }

    const orders = await Order.find({
      user: customer._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error("❌ Customer history error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===============================
// 👑 OWNER: GET ALL ORDERS (HISTORY)
// ===============================
router.get("/all", async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (err) {
    console.error("❌ Owner history error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
