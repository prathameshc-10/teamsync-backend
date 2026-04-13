import { Server } from "socket.io";
import { AuthenticatedSocket, OnlineUser, TypingPayload } from "../types/auth.types";
import {
  createMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  isConversationMember,
} from "./db";

// ─── In-memory presence (never persisted to DB) ───────────────────────────────
// Only transient state lives here — online users, typing indicators.
// Everything else goes through db.ts → Prisma → PostgreSQL.
const onlineUsers = new Map<string, OnlineUser>();

export function registerSocketHandlers(
  io: Server,
  socket: AuthenticatedSocket
): void {
  const userId = socket.user.userId;       // Login.userId
  const username = socket.user.email; // Login.fullName

  // ─── Presence ──────────────────────────────────────────────────────────────
  onlineUsers.set(String(userId), { username, socketId: socket.id });

  socket.broadcast.emit("user:online", { userId, username });

  socket.emit(
    "users:online_list",
    Array.from(onlineUsers.entries()).map(([id, info]) => ({
      userId: Number(id),
      username: info.username,
    }))
  );

  // ─── Join conversation ─────────────────────────────────────────────────────
  socket.on("conversation:join", async ({ conversationId }: { conversationId: number }) => {
    console.log("conversationId=", conversationId);
    try {
      const isMember = await isConversationMember(conversationId, userId);
      if (!isMember) {
        socket.emit("error", { message: "You are not a member of this conversation" });
        return;
      }

      socket.join(String(conversationId));
      socket.to(String(conversationId)).emit("conversation:user_joined", {
        userId,
        username,
        conversationId,
      });
    } catch (err) {
      console.error("conversation:join error:", err);
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  // ─── Leave conversation ────────────────────────────────────────────────────
  socket.on("conversation:leave", ({ conversationId }: { conversationId: number }) => {
    socket.leave(String(conversationId));
    socket.to(String(conversationId)).emit("conversation:user_left", {
      userId,
      username,
      conversationId,
    });
  });

  // ─── Send message ──────────────────────────────────────────────────────────
  socket.on("message:send", async ({
    conversationId,
    text,
  }: {
    conversationId: number;
    text: string;
  }) => {
    if (!conversationId || !text?.trim()) return;

    try {
      // createMessage() from your db.ts — writes to DB immediately
      const message = await createMessage(conversationId, userId, text.trim());

      // Broadcast to all sockets in this conversation room
      io.to(String(conversationId)).emit("message:new", message);
    } catch (err) {
      console.error("message:send error:", err);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // ─── Edit message ──────────────────────────────────────────────────────────
  socket.on("message:edit", async ({
    messageId,
    newText,
  }: {
    messageId: number;
    newText: string;
  }) => {
    if (!newText?.trim()) return;

    try {
      // editMessage() from your db.ts — handles auth check + updates text & editedAt
      const updated = await editMessage(messageId, userId, newText.trim());

      io.to(String(updated.conversationId)).emit("message:edited", {
        messageId: updated.messageId,
        conversationId: updated.conversationId,
        text: updated.content,
        editedAt: updated.editedAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to edit message";
      // "Not authorized" and "Message not found" come directly from your editMessage()
      socket.emit("error", { message });
    }
  });

  // ─── Delete message ────────────────────────────────────────────────────────
  socket.on("message:delete", async ({
    messageId,
    conversationId,
  }: {
    messageId: number;
    conversationId: number;
  }) => {
    try {
      // deleteMessage() from your db.ts — handles auth check + hard deletes
      await deleteMessage(messageId, userId);

      io.to(String(conversationId)).emit("message:deleted", {
        messageId,
        conversationId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete message";
      socket.emit("error", { message });
    }
  });

  // ─── Toggle reaction ───────────────────────────────────────────────────────
  socket.on("message:react", async ({
    messageId,
    conversationId,
    emoji,
  }: {
    messageId: number;
    conversationId: number;
    emoji: string;
  }) => {
    try {
      // toggleReaction() from your db.ts — adds or removes based on existing row
      const result = await toggleReaction(messageId, userId, emoji);

      io.to(String(conversationId)).emit("message:reaction_updated", {
        messageId,
        conversationId,
        emoji: result.emoji,
        action: result.action,   // "added" | "removed"
        userId,
      });
    } catch (err) {
      console.error("message:react error:", err);
      socket.emit("error", { message: "Failed to update reaction" });
    }
  });

  // ─── Typing indicators — WebSocket only, never touch DB ───────────────────
  socket.on("typing:start", ({ conversationId }: TypingPayload) => {
    socket.to(String(conversationId)).emit("typing:started", {
      userId,
      username,
      conversationId,
    });
  });

  socket.on("typing:stop", ({ conversationId }: TypingPayload) => {
    socket.to(String(conversationId)).emit("typing:stopped", {
      userId,
      username,
      conversationId,
    });
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    onlineUsers.delete(String(userId));
    console.log(`❌ ${username} disconnected (${socket.id})`);
    io.emit("user:offline", { userId, username });
  });
}