import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // 👤 Reference to actual customer
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // fast customer lookups
    },

    // 🧾 Snapshot of customer name (DO NOT change later)
    userName: {
      type: String,
      required: true,
      immutable: true,
    },

    // 📞 Snapshot of customer phone
    phone: {
      type: String,
      required: true,
      immutable: true,
    },

    // 🛒 Order items
    items: [
      {
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    // 💰 Total amount
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // 💳 Payment state
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
      index: true,
    },

    // 📦 Order lifecycle
    status: {
      type: String,
      enum: ["requested", "accepted", "completed"],
      default: "requested",
      index: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/* ================================
   🔥 INDEXES (CRITICAL FOR SCALE)
================================ */

// Customer dashboard pagination
orderSchema.index({ user: 1, createdAt: -1 });

// Paid / Unpaid tabs
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

// Live + history views
orderSchema.index({ status: 1, createdAt: -1 });

/* ================================
   🧠 VIRTUALS (NO DB STORAGE)
================================ */

orderSchema.virtual("isPaid").get(function () {
  return this.paymentStatus === "paid";
});

/* ================================
   ✅ MODEL
================================ */

const Order = mongoose.model("Order", orderSchema);

export default Order;
