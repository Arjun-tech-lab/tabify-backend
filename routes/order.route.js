import express from "express";
import Order from "../models/order.models.js";
import User from "../models/user.models.js";



const router = express.Router();
// Create order using sessionKey
router.post("/create", async (req, res) => {
  try {
    const { sessionKey, items, totalAmount } = req.body;

    const user = await User.findOne({ sessionKey });
    if (!user) return res.status(400).json({ success: false, message: "Invalid session" });

    const order = await Order.create({
      user: user._id,
      userName: user.name,
      phone: user.phone,
      items,
      totalAmount,
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Get all orders
router.get("/all", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
