
import "dotenv/config";
import express from "express";
import https from "https";
import fs from "fs";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes";
import meetingRoutes from "./routes/meeting.routes";
import { registerMeetingSocketHandlers } from "./sockets/meeting.socket";

const app = express();

// ── HTTPS Server ─────────────────────────────────────────────
const httpsServer = https.createServer(
  {
    key: fs.readFileSync("./192.168.21.13-key.pem"),
    cert: fs.readFileSync("./192.168.21.13.pem"),
  },
  app
);

// ── Socket.IO setup ──────────────────────────────────────────
const io = new SocketServer(httpsServer, {
  cors: {
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "https://192.168.21.13:3000",
    ],
    credentials: true,
  },
});

// ── Middleware ───────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "https://192.168.21.13:3000",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ── HTTP Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

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
httpsServer.listen(PORT, () => {
  console.log(`[server] running on https://192.168.21.13:${PORT}`);
});

