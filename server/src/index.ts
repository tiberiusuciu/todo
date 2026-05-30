import http from "http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { attachSyncServer } from "./sync/wsServer.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/todos";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required in production");
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && !process.env.REGISTRATION_CODE) {
  console.error("REGISTRATION_CODE is required in production");
  process.exit(1);
}

const app = createApp();

async function start() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const server = http.createServer(app);
  attachSyncServer(server);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
