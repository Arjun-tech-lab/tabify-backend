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
    origin: "*", // Allow all for now (change in prod)
    methods: ["GET", "POST"],
  },
});

let orders = [];

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // 🧾 When a customer sends a new order
  socket.on("newOrder", (order) => {
    console.log("📦 New order received:", order);
    orders.push(order);

    // ✅ Notify ALL connected owner dashboards in real time
    io.emit("newOrder", order);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

server.listen(5001, () => {
  console.log("🚀 Backend running on http://localhost:5001");
});
