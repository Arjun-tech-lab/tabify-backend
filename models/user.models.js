import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid"; // npm install uuid

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  sessionKey: { type: String, unique: true, default: uuidv4 }, // 🔑 Unique session key
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
