import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, unique: true, required: true },
  sessionKey: { type: String, required: true },
  role: {
    type: String,
    enum: ["customer", "owner"],
    default: "customer",
  },
});

const User = mongoose.model("User", userSchema);
export default User;
