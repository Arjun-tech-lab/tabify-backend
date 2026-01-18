import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import userRoutes from "./routes/user.routes.js";
import orderRoutes from "./routes/order.route.js";
import Order from "./models/order.models.js";

// ✅ Load env
dotenv.config();

// ✅ MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

const app = express();

// ✅ CORS
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map((u) => u.trim())
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

// ✅ REST routes
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);

// ✅ Server + Socket
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

// ========================
// 🔌 SOCKET LOGIC
// ========================
const owners = new Set();

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  socket.on("registerRole", (role) => {
    if (role === "owner") {
      owners.add(socket.id);
      console.log("👑 Owner registered:", socket.id);
    }
  });

  // 🔔 NEW ORDER (notify owners only)
  socket.on("newOrder", (order) => {
    owners.forEach((ownerId) => {
      io.to(ownerId).emit("newOrder", order);
    });
  });

  // ✅ OWNER ACCEPTS ORDER (FIXED)
  socket.on("acceptOrder", async (orderId) => {
    try {
      const order = await Order.findOne({ _id: orderId });

      if (!order) return;

      order.status = "accepted";
      await order.save();

      console.log("✅ Order accepted:", orderId);

      // 🔔 Notify customer
      io.emit("orderUpdate", {
        id: order._id.toString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    } catch (err) {
      console.error("❌ acceptOrder error:", err);
    }
  });

  // 💳 PAYMENT UPDATE (FIXED)
  socket.on("updatePaymentStatus", async ({ orderId, paymentStatus }) => {
    try {
      const order = await Order.findOne({ _id: orderId });

      if (!order) return;

      order.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") {
        order.status = "completed";
      }

      await order.save();

      console.log("💰 Payment updated:", orderId, paymentStatus);

      io.emit("orderUpdate", {
        id: order._id.toString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    } catch (err) {
      console.error("❌ payment update error:", err);
    }
  });

  socket.on("disconnect", () => {
    owners.delete(socket.id);
    console.log("❌ Disconnected:", socket.id);
  });
});

// ✅ FETCH ORDER FROM DB (FIXED)
app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Not found" });
    res.json(order);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ START SERVER
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
