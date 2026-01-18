import mongoose from "mongoose";   // ✅ ADD THIS LINE

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true },
    phone: { type: String, required: true },
    items: [{ name: String, quantity: Number, price: Number }],
    totalAmount: Number,
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "completed"],
      default: "requested",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;   // ✅ REQUIRED for ESM
