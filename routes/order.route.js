import express from "express";
import Order from "../models/order.models.js";
import User from "../models/user.models.js";

const router = express.Router();
const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};


// ===============================
// 🧾 CREATE ORDER (Customer ONLY)
// ===============================
router.post("/create", async (req, res) => {
  try {
    const { sessionKey, items, totalAmount } = req.body;

    // 🔐 Validate customer
    const customer = await User.findOne({ sessionKey });
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Invalid session",
      });
    }

    // ✅ Create order
    const order = await Order.create({
      user: customer._id,
      userName: customer.name,
      phone: customer.phone,
      items,
      totalAmount,
    });

    // 🔔 Notify all owners (LIVE REQUESTS)
    const io = req.app.get("io");
    if (io) {
      io.to("owners").emit("newOrder", order);
      console.log("📢 New order sent to owners:", order._id);
    }

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

// ===============================
// 🧾 CUSTOMER: GET MY ORDERS
// ===============================
// ===============================
// 🧾 CUSTOMER: GET MY ORDERS (PAGINATED)
// ===============================
router.get("/my", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing authorization",
      });
    }

    const sessionKey = auth.split(" ")[1];

    const user = await User.findOne({ sessionKey });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid session",
      });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // ✅ CRITICAL FIX: filter by user
    const filter = { user: user._id };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("My orders error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});



//balance  with search 

router.get("/balances", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    const matchStage = {
      paymentStatus: "unpaid"
    };

    const basePipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: "$user",
          userName: { $first: "$userName" },
          phone: { $first: "$phone" },
          totalDue: { $sum: "$totalAmount" },
          lastOrderAt: { $max: "$createdAt" }
        }
      }
    ];

    // 🔍 SEARCH by name (case-insensitive)
    if (search) {
      basePipeline.push({
        $match: {
          userName: { $regex: search, $options: "i" }
        }
      });
    }

    // 🔢 count after grouping + search
    const countResult = await Order.aggregate([
      ...basePipeline,
      { $count: "count" }
    ]);

    const totalCustomers = countResult[0]?.count || 0;

    const balances = await Order.aggregate([
      ...basePipeline,
      { $sort: { lastOrderAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      balances,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCustomers / limit),
        totalCustomers
      }
    });
  } catch (err) {
    console.error("Balance search error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch balances"
    });
  }
});
// ===============================
// 💰 OWNER: MARK CUSTOMER BALANCE AS PAID
// ===============================
router.post("/balances/mark-paid", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const result = await Order.updateMany(
      {
        user: userId,
        paymentStatus: "unpaid"
      },
      {
        $set: { paymentStatus: "paid" }
      }
    );

    // 🔔 Optional: notify owners via socket
    const io = req.app.get("io");
    if (io) {
      io.to("owners").emit("balancePaid", { userId });
    }

    res.json({
      success: true,
      updatedOrders: result.modifiedCount
    });
  } catch (err) {
    console.error("Mark balance paid error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to mark balance as paid"
    });
  }
});



// ===============================
// 👑 OWNER: GET ALL ORDERS (HISTORY)
// ===============================
// 👑 OWNER: ALL ORDERS (PAGINATED)
router.get("/all", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 💰 PAID ORDERS (PAGINATED)
router.get("/paid", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ paymentStatus: "paid" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments({ paymentStatus: "paid" }),
  ]);

  res.json({
    success: true,
    orders,
    pagination: {
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// 🧾 UNPAID ORDERS (PAGINATED)


router.get("/unpaid", async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const filter = { paymentStatus: "unpaid" };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // ⚡ performance boost
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("❌ unpaid pagination error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch unpaid orders",
    });
  }
});




export default router;
