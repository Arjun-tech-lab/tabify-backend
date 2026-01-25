import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import userRoutes from "./routes/user.routes.js";
import orderRoutes from "./routes/order.route.js";
import Order from "./models/order.models.js";

dotenv.config();

// ==================
// MongoDB
// ==================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

const app = express();

// ==================
// CORS
// ==================
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

// 🔥 MAKE IO AVAILABLE TO ROUTES
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

  // ✅ OWNER ACCEPTS ORDER
  socket.on("acceptOrder", async (orderId) => {
    try {
      const order = await Order.findById(orderId);
      if (!order) return;

      order.status = "accepted";
      await order.save();

      io.emit("orderUpdate", order);

    } catch (err) {
      console.error("❌ acceptOrder error:", err);
    }
  });

  // 💳 PAYMENT UPDATE
  socket.on(
    "updatePaymentStatus",
    async ({ orderId, paymentStatus }) => {
      try {
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
    }
  );

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
