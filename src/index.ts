// ============================================================
// src/index.ts  — updated to wire in Socket.IO + meeting routes
// ============================================================

import "dotenv/config";
import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import organizationRoutes from "../src/routes/organization.routes";
import authRoutes from "./routes/auth.routes";
import meetingRoutes from "./routes/meeting.routes";
import profileRoutes from "./routes/profile.routes";
import { registerMeetingSocketHandlers } from "./sockets/meeting.socket";

const app = express();
const httpServer = http.createServer(app);

// ── Socket.IO setup ──────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: [process.env.CLIENT_URL || "http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  },
});

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [process.env.CLIENT_URL || "http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(cookieParser());

// ── HTTP Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/profile", profileRoutes);

// ── Socket.IO connection handler ─────────────────────────────
io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerMeetingSocketHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});