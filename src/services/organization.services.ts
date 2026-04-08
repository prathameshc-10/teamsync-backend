import prisma from '../config/prisma';
import { ORG_MESSAGES } from '../constants/messages';


export const createOrganization = async (orgName: string, userId: number) => {
  return await prisma.organization.create({
    data: {
      orgName,
      userId, // This identifies the owner/creator
      users: {
        create: [
          { 
            // We connect the creator to the membership (User) table
            userId: userId 
          }
        ],
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
  // Check if login exists
  const loginExists = await prisma.login.findUnique({ where: { userId } });
  if (!loginExists) throw { status: 404, message: 'User not found' };

  // Check if ALREADY in THIS specific org
  const alreadyMember = await prisma.user.findFirst({ 
    where: { userId, orgId } 
  });
  if (alreadyMember) throw { status: 409, message: 'User already in this org' };

  // Create membership (This will work now because userId is no longer @unique)
  return await prisma.user.create({ data: { userId, orgId } });
};
