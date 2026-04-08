import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.routes";
import meetingRoutes from "./routes/meeting.routes";
import { registerSocketHandlers } from "./sockets/socketHandler";
import { registerMeetingSocketHandlers } from "./sockets/meeting.socket";
import { JWT_CONFIG } from "./config/jwt.config";
import type { AuthenticatedSocket, JwtPayload } from "./types/auth.types";
import conversationRoutes from "./routes/conversation.routes";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// ── Socket.IO setup ──────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── HTTP Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/conversations", conversationRoutes);

// ── Socket.IO JWT Middleware ─────────────────────────────────
io.use((socket, next) => {
  console.log("=== SOCKET HANDSHAKE ===");
  console.log("auth:", socket.handshake.auth);
  console.log("authorization header:", socket.handshake.headers.authorization);
  console.log("========================");

  const raw =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization;

  if (!raw) return next(new Error("No token"));

  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

  try {
    const decoded = jwt.verify(
      token,
      JWT_CONFIG.ACCESS_TOKEN_SECRET
    ) as JwtPayload;

    (socket as AuthenticatedSocket).user = decoded;
    next();
  } catch (err) {
    console.error("Socket JWT error:", err);
    next(new Error("Invalid token"));
  }
});

// ── Socket.IO Connection Handler ─────────────────────────────
io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerSocketHandlers(io, socket as AuthenticatedSocket);
  registerMeetingSocketHandlers(io, socket as AuthenticatedSocket);

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ── Start Server ─────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});