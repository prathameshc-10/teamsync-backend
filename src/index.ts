import express from "express";
import "./config/env";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.routes";
import { registerSocketHandlers } from "./socket/socketHandler";
import { JWT_CONFIG } from "./config/jwt.config";  // ← import this
import type { AuthenticatedSocket, JwtPayload } from "./types/auth.types";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// JWT middleware — uses same secret as HTTP middleware
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
      JWT_CONFIG.ACCESS_TOKEN_SECRET  // ← same secret as verifyAccessToken
    ) as JwtPayload;

    (socket as AuthenticatedSocket).user = decoded;
    next();
  } catch (err) {
    console.error("Socket JWT error:", err); // ← see exact failure reason
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket as AuthenticatedSocket);
});

// ✅ ONE listener only — httpServer, not app.listen
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));