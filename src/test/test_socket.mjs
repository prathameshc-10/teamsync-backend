import { io } from "socket.io-client";

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AcHJpbWF2ZXJzZS5jb20iLCJpYXQiOjE3NzU3MjY0MDksImV4cCI6MTc3NTcyNzMwOX0.yuawPyHi-SGlX_XUk4Y2JO5OE31ngFB49cpU4tVHXoI"; // from /api/auth/login response
const meetingId = "2c1fc33d-19f5-411b-803e-628e84902a7f";

const socket = io("http://localhost:4000", {
  auth: { token },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("✅ Connected! Socket ID:", socket.id);

  socket.emit("meeting:join", {
    meetingId,
    token,
  });
});

socket.on("meeting:joined", (data) => {
  console.log("✅ Joined meeting:", JSON.stringify(data, null, 2));
});

socket.on("meeting:error", (err) => {
  console.log("❌ Meeting error:", err);
});

socket.on("connect_error", (err) => {
  console.log("❌ Connection error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Disconnected:", reason);
});