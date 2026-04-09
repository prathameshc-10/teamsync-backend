import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.routes";
import meetingRoutes from "./routes/meeting.routes";
import conversationRoutes from "./routes/conversation.routes";
import { registerSocketHandlers } from "./sockets/socketHandler";
import { registerMeetingSocketHandlers } from "./sockets/meeting.socket";
import { JWT_CONFIG } from "./config/jwt.config";
import type { AuthenticatedSocket, JwtPayload } from "./types/auth.types";

const app = express();
const PORT = process.env.PORT || 4001;

// ── HTTP Server ───────────────────────────────────────────────
const httpServer = createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── HTTP Routes ───────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/conversations", conversationRoutes);

// ── Socket.IO JWT Middleware ──────────────────────────────────
io.use((socket, next) => {
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

// ── Socket.IO Connection ──────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerSocketHandlers(io, socket as AuthenticatedSocket);
  registerMeetingSocketHandlers(io, socket as AuthenticatedSocket);

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ── Start ─────────────────────────────────────────────────────
// ── Start ─────────────────────────────────────────────────────
httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`[server] running on http://192.168.21.13:${PORT}`);
});