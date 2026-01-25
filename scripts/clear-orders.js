import mongoose from "mongoose";
import Order from "../models/order.models.js";

await mongoose.connect("mongodb://localhost:27017/tabify");

await Order.deleteMany({});

console.log("All orders deleted");
process.exit();
