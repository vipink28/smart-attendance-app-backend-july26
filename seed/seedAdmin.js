// Run once via: npm run seed:admin
// Creates the initial admin account from .env values, since the system has
// no public registration - every other account is created BY this admin.
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function seedAdmin() {
  await connectDB();

  const existing = await User.findOne({
    email: process.env.ADMIN_EMAIL.toLowerCase(),
  });
  if (existing) {
    console.log("Admin already exists:", existing.email);
    process.exit(0);
  }

  const admin = await User.create({
    name: process.env.ADMIN_NAME || "Super Admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  });

  console.log("Admin account created:");
  console.log(`  Email: ${admin.email}`);
  console.log("  Password: (as set in .env - change it after first login)");

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
