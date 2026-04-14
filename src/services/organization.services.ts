// organization.services.ts
import prisma from '../config/prisma';

async function assertOrgMembership(orgId: number, userId: number): Promise<void> {
  const membership = await prisma.user.findFirst({
    where: { orgId, userId },
    select: { id: true },
  });

  if (!membership) {
    throw { status: 403, message: 'You are not a member of this organization' };
  }
}

async function getOrCreateOrgConversation(orgId: number): Promise<{ conversationId: number }> {
  const existing = await prisma.conversation.findFirst({
    where: { orgId, type: 'channel' },
    select: { conversationId: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      orgId,
      type: 'channel',
    },
    select: { conversationId: true },
  });
}

async function syncOrgMembersToConversation(orgId: number, conversationId: number): Promise<void> {
  const members = await prisma.user.findMany({
    where: { orgId },
    select: { userId: true },
  });

  if (!members.length) {
    return;
  }

  await prisma.conversationMember.createMany({
    data: members.map((m) => ({
      conversationId,
      userId: m.userId,
    })),
    skipDuplicates: true,
  });
}

export const createOrganization = async (orgName: string, userId: number) => {
  return await prisma.organization.create({
    data: {
      orgName,
      userId,
      users: {
        create: [{ userId }],
      },
    },
    include: { users: true },
  });
};

export const getMyOrganizations = async (userId: number) => {
  return await prisma.organization.findMany({
    where: {
      users: { some: { userId } },
    },
    include: {
      _count: { select: { users: true, conversations: true } },
    },
  });
};

export const getMembers = async (orgId: number) => {
  return await prisma.user.findMany({
    where: { orgId: orgId,},
    include: {
      login: {
        select: {
          userId: true,
          fullName: true,
          email: true,
          isVerified: true,
          createdAt: true,
        },
      },
    },
  });
};

export const addMember = async (orgId: number, email: string) => {
  // Step 1 — find the login record by email
  const loginExists = await prisma.login.findUnique({ 
    where: { email } 
  })

  if (!loginExists) {
    throw { status: 404, message: 'No user found with that email' }
  }

  // Step 2 — check if already a member of this org
  const alreadyMember = await prisma.user.findFirst({
    where: { 
      userId: loginExists.userId, 
      orgId 
    }
  })

  if (alreadyMember) {
    throw { status: 409, message: 'User is already a member of this organization' }
  }

  // Step 3 — add them
  const user = await prisma.user.create({ 
    data: { 
      userId: loginExists.userId, 
      orgId 
    } 
  });

  const existingOrgConversation = await prisma.conversation.findFirst({
    where: { orgId, type: 'channel' },
    select: { conversationId: true },
  });

  if (existingOrgConversation) {
    await prisma.conversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId: existingOrgConversation.conversationId,
          userId: loginExists.userId,
        },
      },
      create: {
        conversationId: existingOrgConversation.conversationId,
        userId: loginExists.userId,
      },
      update: {},
    });
  }

  return user;
}

export const deleteOrganization = async (orgId: number, userId: number) => {
  const org = await prisma.organization.findUnique({ where: { orgId: orgId, } });
  if (!org) throw { status: 404, message: 'Organization not found' };
  if (org.userId !== userId) throw { status: 403, message: 'Only the owner can delete this organization' };
  return await prisma.organization.delete({ where: { orgId } });
};

export const getOrgChat = async (orgId: number, userId: number) => {
  await assertOrgMembership(orgId, userId);

  const conversation = await getOrCreateOrgConversation(orgId);
  await syncOrgMembersToConversation(orgId, conversation.conversationId);

  const fullConversation = await prisma.conversation.findUnique({
    where: { conversationId: conversation.conversationId },
    include: {
      messages: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              userId: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return fullConversation;
};

export const sendOrgChatMessage = async (orgId: number, userId: number, content: string) => {
  await assertOrgMembership(orgId, userId);

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw { status: 400, message: 'Message content is required' };
  }

  const conversation = await getOrCreateOrgConversation(orgId);
  await syncOrgMembersToConversation(orgId, conversation.conversationId);

  return prisma.message.create({
    data: {
      conversationId: conversation.conversationId,
      senderId: userId,
      content: trimmedContent,
    },
    include: {
      sender: {
        select: {
          userId: true,
          fullName: true,
          email: true,
        },
      },
    },
  });
};