import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // ✅ Load .env variables

const app = express();

// ✅ Read allowed client URLs (comma-separated)
const allowedOrigins = process.env.CLIENT_URLS
  ? process.env.CLIENT_URLS.split(",").map((url) => url.trim())
  : ["*"];

// ✅ Use dynamic CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked for origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

const server = http.createServer(app);

// ✅ Socket.io with same CORS config
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

let orders = [];
let owners = new Set();
let customers = new Map();

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("registerRole", (role) => {
    if (role === "owner") {
      owners.add(socket.id);
      console.log(`👑 Owner registered: ${socket.id}`);
    } else if (role === "customer") {
      customers.set(socket.id, {});
      console.log(`🧾 Customer registered: ${socket.id}`);
    }
  });

  socket.on("newOrder", (order) => {
    const newOrder = {
      ...order,
      id: order.id || Date.now().toString(),
      status: "pending",
      paymentStatus: "unpaid",
      customerSocketId: socket.id,
    };

    orders.push(newOrder);
    console.log("📦 New order:", newOrder);

    owners.forEach((ownerId) => {
      io.to(ownerId).emit("newOrder", newOrder);
    });
  });

  socket.on("acceptOrder", (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = "accepted";
      console.log(`✅ Order accepted: ${orderId}`);

      owners.forEach((ownerId) => {
        io.to(ownerId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
      });

      if (order.customerSocketId) {
        io.to(order.customerSocketId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
        console.log(`📢 Sent update to customer: ${order.customerSocketId}`);
      }
    }
  });

  socket.on("updatePaymentStatus", ({ orderId, paymentStatus }) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.paymentStatus = paymentStatus;
      order.status = paymentStatus === "paid" ? "paid" : order.status;

      console.log(`💰 Payment updated: ${orderId} → ${paymentStatus}`);

      owners.forEach((ownerId) => {
        io.to(ownerId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
      });

      if (order.customerSocketId) {
        io.to(order.customerSocketId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
      }
    }
  });

  socket.on("reconnectOrder", (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.customerSocketId = socket.id;
      console.log(`🔁 Customer reconnected for order ${orderId}: ${socket.id}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    owners.delete(socket.id);
    customers.delete(socket.id);
  });
});

// ✅ REST API for refreshing order on page reload
app.get("/api/orders/:id", (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json(order);
});

// ✅ Use environment PORT (fallback 5001)
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(", ")}`);
});
