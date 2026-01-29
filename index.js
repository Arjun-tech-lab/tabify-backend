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
   ✅ CORS CONFIG (FINAL)
====================== */
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map(o => o.trim())
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow Postman, curl

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS blocked"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
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
    }
  });

  socket.on("acceptOrder", async (orderId) => {
    const order = await Order.findById(orderId);
    if (!order) return;

    order.status = "accepted";
    await order.save();
    io.emit("orderUpdate", order);
  });

  socket.on("updatePaymentStatus", async ({ orderId, paymentStatus }) => {
    if (!orderId || !["paid", "unpaid"].includes(paymentStatus)) return;

    const order = await Order.findById(orderId);
    if (!order) return;

    order.paymentStatus = paymentStatus;
    if (paymentStatus === "paid") order.status = "completed";

    await order.save();
    io.emit("orderUpdate", order);
  });
});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
 