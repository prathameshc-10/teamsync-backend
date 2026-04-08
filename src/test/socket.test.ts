// ============================================================
// test/socket.test.ts
// Run: npx ts-node test/socket.test.ts
// ============================================================
import { io, Socket } from "socket.io-client";
import axios from "axios";

const SERVER_URL = "http://localhost:4000";
const API_URL = "http://localhost:4000/api/auth";

// ── Step 1: Login to get a fresh token ───────────────────────────────────────
async function login(): Promise<string> {
  const res = await axios.post(`${API_URL}/login`, {
    email: "admin@primaverse.com",
    password: "Admin@123", // ← change this to your actual password
  });

  const token = res.data.accessToken || res.data.data?.accessToken || res.data.token;
  console.log(token);
  if (!token) {
    console.error("❌ Login response:", res.data);
    throw new Error("No token found in login response");
  }

  console.log("✅ Login successful");
  console.log("🔑 Token:", token.slice(0, 40) + "...");
  return token;
}

// ── Step 2: Connect socket with token ────────────────────────────────────────
function connectSocket(token: string): Socket {
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}

// ── Step 3: Run tests ─────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n🚀 Starting socket tests...\n");

  // 1. Get token
  const token = await login();

  // 2. Connect
  const socket = connectSocket(token);

  socket.on("connect", () => {
    console.log("✅ Socket connected! ID:", socket.id);

    // 3. Join conversation
    console.log("\n📌 Joining conversation 1...");
    socket.emit("conversation:join", { conversationId: 1 });

    // 4. Send message after short delay
    setTimeout(() => {
      console.log("\n📨 Sending message...");
      socket.emit("message:send", {
        conversationId: 1,
        text: "Hello from test script! 🚀",
      });
    }, 500);

    // 5. Edit message after delay (use a real messageId from your DB)
    setTimeout(() => {
      console.log("\n✏️  Editing message...");
      socket.emit("message:edit", {
        messageId: 1, // ← change to a real messageId
        newText: "Edited message text",
      });
    }, 1000);

    // 6. React to message
    setTimeout(() => {
      console.log("\n😄 Reacting to message...");
      socket.emit("message:react", {
        conversationId: 1,
        messageId: 1, // ← change to a real messageId
        emoji: "👍",
      });
    }, 1500);

    // 7. Typing indicators
    setTimeout(() => {
      console.log("\n⌨️  Sending typing:start...");
      socket.emit("typing:start", { conversationId: 1 });
    }, 2000);

    setTimeout(() => {
      socket.emit("typing:stop", { conversationId: 1 });
      console.log("⌨️  Sending typing:stop...");
    }, 2500);

    // 8. Disconnect after all tests
    setTimeout(() => {
      console.log("\n👋 Disconnecting...");
      socket.disconnect();
      process.exit(0);
    }, 3500);
  });

  // ── Listen for all server broadcasts ───────────────────────────────────────
  socket.on("message:new", (data) => {
    console.log("📨 message:new received:", JSON.stringify(data, null, 2));
  });

  socket.on("message:edited", (data) => {
    console.log("✏️  message:edited received:", JSON.stringify(data, null, 2));
  });

  socket.on("message:deleted", (data) => {
    console.log("🗑️  message:deleted received:", JSON.stringify(data, null, 2));
  });

  socket.on("message:reaction", (data) => {
    console.log("😄 message:reaction received:", JSON.stringify(data, null, 2));
  });

  socket.on("typing:update", (data) => {
    console.log("⌨️  typing:update received:", JSON.stringify(data, null, 2));
  });

  socket.on("online:update", (data) => {
    console.log("🟢 online:update received:", JSON.stringify(data, null, 2));
  });

  socket.on("conversation:user_joined", (data) => {
    console.log("🚪 conversation:user_joined:", JSON.stringify(data, null, 2));
  });

  socket.on("error", (data) => {
    console.error("❌ error received:", data);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Disconnected:", reason);
  });
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});