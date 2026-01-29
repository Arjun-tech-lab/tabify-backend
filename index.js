import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import userRoutes from "./routes/user.routes.js";
import orderRoutes from "./routes/order.route.js";
import Order from "./models/order.models.js";
import { connectDB } from "./config/db.js";

dotenv.config();
connectDB();

const app = express();

/* ======================
   ✅ CORS CONFIG (FIXED)
====================== */
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map(o => o.trim())
  : [];

if (allowedOrigins.length === 0) {
  console.warn("⚠️ CLIENT_URLS not set");
}

const corsOptions = {
  origin: function (origin, callback) {
    // allow server-to-server, Postman, curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS blocked for origin: ${origin}`)
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // 🔥 REQUIRED

app.use(express.json());

/* ======================
   REST ROUTES
====================== */
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);

/* ======================
   SERVER + SOCKET
====================== */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set("io", io);

/* ======================
   SOCKET LOGIC
====================== */
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  socket.on("registerRole", (role) => {
    if (role === "owner") {
      socket.join("owners");
      console.log("👑 Owner joined owners room:", socket.id);
    }
  });

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

  socket.on("updatePaymentStatus", async ({ orderId, paymentStatus }) => {
    try {
      if (!orderId || !["paid", "unpaid"].includes(paymentStatus)) return;

      const order = await Order.findById(orderId);
      if (!order) return;

      order.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") order.status = "completed";

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

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
