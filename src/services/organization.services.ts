// organization.services.ts
import prisma from '../config/prisma';

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

export const addMember = async (orgId: number, userId: number) => {
  const loginExists = await prisma.login.findUnique({ where: { userId } });
  if (!loginExists) throw { status: 404, message: 'User not found' };

  const alreadyMember = await prisma.user.findFirst({ where: { userId, orgId } });
  if (alreadyMember) throw { status: 409, message: 'User already in this org' };

  return await prisma.user.create({ data: { userId, orgId } });
};

export const deleteOrganization = async (orgId: number, userId: number) => {
  const org = await prisma.organization.findUnique({ where: { orgId: orgId, } });
  if (!org) throw { status: 404, message: 'Organization not found' };
  if (org.userId !== userId) throw { status: 403, message: 'Only the owner can delete this organization' };
  return await prisma.organization.delete({ where: { orgId } });
};