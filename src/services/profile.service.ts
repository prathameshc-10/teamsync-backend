import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { validatePassword } from "../utils/validation";
import { BCRYPT_SALT_ROUNDS } from "../config/jwt.config";
import type { UpdateProfileBody, ChangePasswordBody, ProfileResponse } from "../types/profile.types";

// ================================================================
// getProfile
// Fetches Login + all orgs the user belongs to via User join
// ================================================================
export async function getProfile(userId: number): Promise<ProfileResponse> {
  const login = await prisma.login.findUnique({
    where: { userId },
  });
  if (!login) throw new Error("User not found");

  // User → Organization join to get all orgs + isActive per org
  const userOrgs = await prisma.user.findMany({
    where: { userId },
    include: {
      org: true,
    },
  });

  const organizations = userOrgs.map((u) => ({
    orgId: u.org.orgId,
    orgName: u.org.orgName,
    createdAt: u.org.createdAt,
    isActive: u.isActive,
  }));

  const { password: _pw, ...safeLogin } = login;
  return { ...safeLogin, organizations };
}

// ================================================================
// updateProfile
// Updates fullName and/or email on Login model
// ================================================================
export async function updateProfile(
  userId: number,
  body: UpdateProfileBody
): Promise<Omit<ProfileResponse, "organizations">> {
  const { fullName, email } = body;

  if (!fullName?.trim()) throw new Error("Full name is required");
  if (!email?.trim()) throw new Error("Email is required");

  // Check email not taken by another user
  const existing = await prisma.login.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing && existing.userId !== userId) {
    throw new Error("Email is already in use by another account");
  }

  const updated = await prisma.login.update({
    where: { userId },
    data: {
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
    },
  });

  const { password: _pw, ...safeLogin } = updated;
  return safeLogin;
}

// ================================================================
// changePassword
// Verifies currentPassword against Login.password (bcrypt),
// then hashes and saves the new one — same pattern as auth.service
// ================================================================
export async function changePassword(
  userId: number,
  body: ChangePasswordBody
): Promise<void> {
  const { currentPassword, newPassword, confirmPassword } = body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("All password fields are required");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("New passwords do not match");
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const login = await prisma.login.findUnique({ where: { userId } });
  if (!login) throw new Error("User not found");

  // Verify current password using same bcrypt pattern as loginUser
  const isMatch = await bcrypt.compare(currentPassword, login.password);
  if (!isMatch) throw new Error("Current password is incorrect");

  if (await bcrypt.compare(newPassword, login.password)) {
    throw new Error("New password must be different from current password");
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  await prisma.login.update({
    where: { userId },
    data: { password: hashedPassword },
  });
}