import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // 👤 Customer (ONLY real user)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    userName: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    items: [
      {
        name: String,
        quantity: Number,
        price: Number,
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },

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

export default Order;
