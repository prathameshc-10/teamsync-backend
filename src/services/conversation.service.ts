import prisma from "../config/prisma";
import { CONVERSATION_MESSAGES } from "../constants/messages";
import type { CreateConversationBody, AddMemberBody } from "../types/conversation.types";

export async function createConversation(
  requesterId: number,
  body: CreateConversationBody
) {
  const { type = "direct", orgId, memberUserIds } = body;

  // Always include the requester as a member
  const allMemberIds = [...new Set([requesterId, ...memberUserIds])];

  const conversation = await prisma.conversation.create({
    data: {
      type,
      orgId: orgId ?? null,
      members: {
        create: allMemberIds.map((userId) => ({ userId })),
      },
    },
    include: {
      members: {
        include: {
          login: { select: { userId: true, fullName: true, email: true } },
        },
      },
    },
  });

  return conversation;
}

export async function addMember(
  conversationId: number,
  requesterId: number,
  body: AddMemberBody
) {
  // Check requester is a member
  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: requesterId },
  });
  if (!isMember) throw new Error(CONVERSATION_MESSAGES.NOT_A_MEMBER);

  // Check target user isn't already a member
  const alreadyMember = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: body.userId },
  });
  if (alreadyMember) throw new Error(CONVERSATION_MESSAGES.ALREADY_A_MEMBER);

  return prisma.conversationMember.create({
    data: { conversationId, userId: body.userId },
    include: {
      login: { select: { userId: true, fullName: true, email: true } },
    },
  });
}

export async function getMyConversations(userId: number) {
  return prisma.conversation.findMany({
    where: {
      members: { some: { userId } },
    },
    include: {
      members: {
        include: {
          login: { select: { userId: true, fullName: true, email: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1, // last message preview
        include: {
          sender: { select: { userId: true, fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}