import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { BCRYPT_SALT_ROUNDS, JWT_CONFIG } from "../config/jwt.config";
import { validateEmail, validatePassword } from "../utils/validation";
import { generateAndSendOtp, verifyOtp as checkOtp } from "./otp.service";
import prisma from "../config/prisma";
import type {
  JwtPayload,
  TokenPair,
  InitiateRegisterBody,
  VerifyRegisterOtpBody,
  CompleteRegisterBody,
  LoginBody,
  ForgotPasswordBody,
  VerifyForgotOtpBody,
  ResetPasswordBody,
} from "../types/auth.types";
import { AUTH_MESSAGES } from "../constants/messages";

// In-memory stores — swap for Redis in production
const refreshTokenStore: Set<string> = new Set();
const resetTokenStore: Map<string, { email: string; expiresAt: Date }> = new Map();

// Tracks emails that have passed OTP verification but not yet completed registration
const verifiedEmails: Set<string> = new Set();

type SafeLogin = Omit<
  Awaited<ReturnType<typeof prisma.login.findUniqueOrThrow>>,
  "password"
>;

// ================================================================
// generateTokens
// ================================================================
export function generateTokens(userId: number, email: string): TokenPair {
  const payload: JwtPayload = { userId, email };

  const accessToken = jwt.sign(payload, JWT_CONFIG.ACCESS_TOKEN_SECRET, {
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign(payload, JWT_CONFIG.REFRESH_TOKEN_SECRET, {
    expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY,
  });

  refreshTokenStore.add(refreshToken);
  return { accessToken, refreshToken };
}

// ================================================================
// Register Step 1 — validate email, check not already registered, send OTP
// ================================================================
export async function initiateRegistration(
  body: InitiateRegisterBody
): Promise<void> {
  const { email } = body;

  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);

  const existing = await prisma.login.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) throw new Error(AUTH_MESSAGES.EMAIL_EXISTS);

  await generateAndSendOtp(email.toLowerCase());
}

// ================================================================
// Register Step 2 — verify OTP, mark email as verified
// ================================================================
export async function verifyRegistrationOtp(
  body: VerifyRegisterOtpBody
): Promise<{ message: string }> {
  const { email, otp } = body;

  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);

  const isValid = await checkOtp(email.toLowerCase(), otp);
  if (!isValid) throw new Error(AUTH_MESSAGES.OTP_INVALID);

  // Mark email as OTP-verified so Step 3 can proceed
  verifiedEmails.add(email.toLowerCase());

  return { message: AUTH_MESSAGES.OTP_VERIFIED };
}

// ================================================================
// Register Step 3 — set name + password, create Login record
// ================================================================
export async function completeRegistration(
  body: CompleteRegisterBody
): Promise<{ user: SafeLogin; tokens: TokenPair }> {
  const { email, fullName, password } = body;

  if (!fullName?.trim()) throw new Error(AUTH_MESSAGES.NAME_REQUIRED);

  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  // Ensure user actually passed OTP verification
  if (!verifiedEmails.has(email.toLowerCase())) {
    throw new Error(AUTH_MESSAGES.EMAIL_NOT_VERIFIED);
  }

  // Double-check email not registered between step 2 and 3
  const existing = await prisma.login.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) throw new Error(AUTH_MESSAGES.EMAIL_EXISTS);

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const newLogin = await prisma.login.create({
    data: {
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: true,
    },
  });

  // Clean up verified email store
  verifiedEmails.delete(email.toLowerCase());

  const tokens = generateTokens(newLogin.userId, newLogin.email);
  const { password: _pw, ...safeLogin } = newLogin;
  return { user: safeLogin, tokens };
}

// ================================================================
// Login — email + password, returns tokens directly (no OTP)
// ================================================================
export async function loginUser(
  body: LoginBody
): Promise<{ user: SafeLogin; tokens: TokenPair }> {
  const { email, password } = body;

  const login = await prisma.login.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!login) throw new Error(AUTH_MESSAGES.EMAIL_INVALID);

  if (!login.isVerified) throw new Error(AUTH_MESSAGES.NOT_VERIFIED);

  const isMatch = await bcrypt.compare(password, login.password);
  if (!isMatch) throw new Error(AUTH_MESSAGES.EMAIL_INVALID);

  const tokens = generateTokens(login.userId, login.email);
  const { password: _pw, ...safeLogin } = login;
  return { user: safeLogin, tokens };
}

// ================================================================
// refreshAccessToken
// ================================================================
export function refreshAccessToken(refreshToken: string): { accessToken: string } {
  if (!refreshTokenStore.has(refreshToken)) {
    throw new Error(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
  }

  const payload = jwt.verify(
    refreshToken,
    JWT_CONFIG.REFRESH_TOKEN_SECRET
  ) as JwtPayload;

  const accessToken = jwt.sign(
    { userId: payload.userId, email: payload.email },
    JWT_CONFIG.ACCESS_TOKEN_SECRET,
    { expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY }
  );

  return { accessToken };
}

// ================================================================
// logoutUser
// ================================================================
export function logoutUser(refreshToken: string): void {
  refreshTokenStore.delete(refreshToken);
}

// ================================================================
// getLoginById — used by /me endpoint
// ================================================================
export async function getLoginById(userId: number): Promise<SafeLogin | null> {
  const login = await prisma.login.findUnique({ where: { userId } });
  if (!login) return null;
  const { password: _pw, ...safeLogin } = login;
  return safeLogin;
}

// ================================================================
// forgotPassword
// ================================================================
export async function forgotPassword(
  body: ForgotPasswordBody
): Promise<{ message: string }> {
  const { email } = body;

  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);

  const login = await prisma.login.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!login) throw new Error(AUTH_MESSAGES.EMAIL_NOT_FOUND);

  await generateAndSendOtp(email.toLowerCase());
  return { message: AUTH_MESSAGES.FORGOT_PASSWORD_OTP_SENT };
}

// ================================================================
// verifyForgotOtp
// ================================================================
export async function verifyForgotOtp(
  body: VerifyForgotOtpBody
): Promise<{ resetToken: string; message: string }> {
  const { email, otp } = body;

  const isValid = await checkOtp(email.toLowerCase(), otp);
  if (!isValid) throw new Error(AUTH_MESSAGES.OTP_INVALID);

  const resetToken = uuidv4();
  resetTokenStore.set(resetToken, {
    email: email.toLowerCase(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  return { resetToken, message: AUTH_MESSAGES.FORGOT_OTP_VERIFIED };
}

// ================================================================
// resetPassword
// ================================================================
export async function resetPassword(
  body: ResetPasswordBody
): Promise<{ message: string }> {
  const { resetToken, newPassword } = body;

  const entry = resetTokenStore.get(resetToken);
  if (!entry) throw new Error(AUTH_MESSAGES.RESET_TOKEN_INVALID);

  if (new Date() > entry.expiresAt) {
    resetTokenStore.delete(resetToken);
    throw new Error(AUTH_MESSAGES.RESET_TOKEN_INVALID);
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  await prisma.login.update({
    where: { email: entry.email },
    data: { password: hashedPassword },
  });

  resetTokenStore.delete(resetToken);
  return { message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS };
}