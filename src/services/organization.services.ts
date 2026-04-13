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
  return await prisma.user.create({ 
    data: { 
      userId: loginExists.userId, 
      orgId 
    } 
  })
}

export const deleteOrganization = async (orgId: number, userId: number) => {
  const org = await prisma.organization.findUnique({ where: { orgId: orgId, } });
  if (!org) throw { status: 404, message: 'Organization not found' };
  if (org.userId !== userId) throw { status: 403, message: 'Only the owner can delete this organization' };
  return await prisma.organization.delete({ where: { orgId } });
};