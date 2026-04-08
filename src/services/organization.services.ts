import prisma from '../config/prisma';
import { ORG_MESSAGES } from '../constants/messages';

export const createOrganization = async (orgName: string, userId: number) => {
  return await prisma.organization.create({
    data: {
      orgName,
      userId,
      users: {
        create: { userId },
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
    where: { orgId },
    include: {
      login: { select: { userId: true, fullName: true, email: true } },
    },
  });
};

export const addMember = async (orgId: number, userId: number) => {
  const loginExists = await prisma.login.findUnique({ where: { userId } });
  if (!loginExists) throw { status: 404, message: ORG_MESSAGES.ERROR.USER_NOT_FOUND  };

  const alreadyMember = await prisma.user.findFirst({ where: { userId, orgId } });
  if (alreadyMember) throw { status: 409,  message: ORG_MESSAGES.ERROR.ALREADY_MEMBER};

  return await prisma.user.create({ data: { userId, orgId } });
};