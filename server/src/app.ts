import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import todosRouter from "./routes/todos.js";
import { requireAuth } from "./middleware/auth.js";
import { getAppVersion } from "./version.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ version: getAppVersion() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/todos", requireAuth, todosRouter);

  return app;
}
