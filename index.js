import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import userRoutes from "./routes/user.routes.js";
import orderRoutes from "./routes/order.route.js";
import Order from "./models/order.models.js";
import { connectDB } from "./config/db.js";

dotenv.config();
connectDB();




// ==================
// MongoDB
// ==================


const app = express();

// ==================
// CORS
// ==================
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map((u) => u.trim())
  : [];

if (allowedOrigins.length === 0) {
  console.warn("⚠️ CLIENT_URLS not set");
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

// ==================
// REST ROUTES
// ==================
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);

// ==================
// SERVER + SOCKET
// ==================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// 🔥 MAKE IO AVAILABLE TO ROUTES (IMPORTANT)
app.set("io", io);

// ==================
// SOCKET LOGIC
// ==================
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  // 👑 OWNER REGISTRATION
  socket.on("registerRole", (role) => {
    if (role === "owner") {
      socket.join("owners");
      console.log("👑 Owner joined owners room:", socket.id);
    }
  });

  // =============================
  // ✅ OWNER ACCEPTS ORDER
  // =============================
  socket.on("acceptOrder", async (orderId) => {
    try {
      const order = await Order.findById(orderId);
      if (!order) return;

      order.status = "accepted";
      await order.save();

      // 🔔 ALWAYS emit FULL order
      io.emit("orderUpdate", order);

      console.log("✅ Order accepted:", order._id);
    } catch (err) {
      console.error("❌ acceptOrder error:", err);
    }
  });

  // =============================
  // 💳 PAYMENT UPDATE
  // =============================
 socket.on("updatePaymentStatus", async ({ orderId, paymentStatus }) => {
  try {
    if (
      !orderId ||
      !["paid", "unpaid"].includes(paymentStatus)
    ) {
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) return;

    order.paymentStatus = paymentStatus;
    if (paymentStatus === "paid") {
      order.status = "completed";
    }

    await order.save();
    io.emit("orderUpdate", order);
  } catch (err) {
    console.error("❌ payment update error:", err);
  }
});


  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

// ==================
// START SERVER
// ==================
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
