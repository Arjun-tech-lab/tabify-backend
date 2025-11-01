import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let orders = [];
let owners = new Set();
let customers = new Map();

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // Identify role
  socket.on("registerRole", (role) => {
    if (role === "owner") {
      owners.add(socket.id);
      console.log(`👑 Owner registered: ${socket.id}`);
    } else if (role === "customer") {
      customers.set(socket.id, {});
      console.log(`🧾 Customer registered: ${socket.id}`);
    }
  });

  // 🧾 Customer places a new order
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

    // Notify all owners
    owners.forEach((ownerId) => {
      io.to(ownerId).emit("newOrder", newOrder);
    });
  });

  // 👑 Owner accepts order
  socket.on("acceptOrder", (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = "accepted";
      console.log(`✅ Order accepted: ${orderId}`);

      // Notify all owners
      owners.forEach((ownerId) => {
        io.to(ownerId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
      });

      // Notify that specific customer
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

  // 💳 Customer updates payment status
  socket.on("updatePaymentStatus", ({ orderId, paymentStatus }) => {
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.paymentStatus = paymentStatus;
      order.status = paymentStatus === "paid" ? "paid" : order.status;

      console.log(`💰 Payment updated: ${orderId} → ${paymentStatus}`);

      // Notify all owners
      owners.forEach((ownerId) => {
        io.to(ownerId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
      });

      // Notify same customer
      if (order.customerSocketId) {
        io.to(order.customerSocketId).emit("orderUpdate", {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        });
      }
    }
  });

  // 🔁 When a customer refreshes, reconnect them to their order
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

server.listen(5001, () =>
  console.log("🚀 Server running on http://localhost:5001")
);
