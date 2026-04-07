// ============================================================
// src/socket/db.ts
// ============================================================
import prisma from "../config/prisma"

// const prisma = new PrismaClient();

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function createMessage(
  conversationId: number,
  senderId: number,
  content: string
) {
  return prisma.message.create({
    data: { conversationId, senderId, content },
    include: {
      sender: { select: { userId: true, fullName: true, email: true } },
      reactions: true,
    },
  });
}

export async function editMessage(
  messageId: number,
  requesterId: number,
  newText: string
) {
  const message = await prisma.message.findUnique({ where: { messageId } });
  if (!message) throw new Error("Message not found");
  if (message.senderId !== requesterId) throw new Error("Not authorized");

  return prisma.message.update({
    where: { messageId },
    data: { content: newText, editedAt: new Date() },
    select:{
        messageId: true,
        conversationId: true,
        content: true,
        editedAt: true,
    },
  });
}

export async function deleteMessage(messageId: number, requesterId: number) {
  const message = await prisma.message.findUnique({ where: { messageId } });
  if (!message) throw new Error("Message not found");
  if (message.senderId !== requesterId) throw new Error("Not authorized");

  return prisma.message.delete({ where: { messageId } });
}

// ─── Reactions (toggle) ───────────────────────────────────────────────────────

export async function toggleReaction(
  messageId: number,
  userId: number,
  emoji: string
) {
  const existing = await prisma.reaction.findFirst({
    where: { messageId, userId, emoji },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { reacctionId: existing.reacctionId } });
    return { action: "removed" as const, emoji };
  }

  await prisma.reaction.create({ data: { messageId, userId, emoji } });
  return { action: "added" as const, emoji };
}

// ─── Membership guard ─────────────────────────────────────────────────────────

export async function isConversationMember(
  conversationId: number,
  userId: number
): Promise<boolean> {
  const member = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  return !!member;
}

export default prisma;