// ============================================================
// src/index.ts  — updated to wire in Socket.IO + meeting routes
// ============================================================

import "dotenv/config";
import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import organizationRoutes from "./routes/organization.routes"; 
import authRoutes from "./routes/auth.routes";
import meetingRoutes from "./routes/meeting.routes";
import { registerMeetingSocketHandlers } from "./sockets/meeting.socket";

const app = express();
const httpServer = http.createServer(app); // wrap express in http.Server for Socket.IO
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || "http://localhost:3000").split(",");
// ── Socket.IO setup ──────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
});

// app.use(cors({
//   origin: ALLOWED_ORIGINS,
//   credentials: true,
// }));

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── HTTP Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/organizations", organizationRoutes);

// ── Socket.IO connection handler ─────────────────────────────
io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Register all meeting-related socket event handlers
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