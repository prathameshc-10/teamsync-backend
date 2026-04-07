// ============================================================
// src/controllers/auth.controller.ts
// ============================================================

import { Request, Response } from "express";
import * as AuthService from "../services/auth.service";
import type {
  AuthRequest,
  InitiateRegisterBody,
  VerifyRegisterOtpBody,
  CompleteRegisterBody,
  LoginBody,
  ForgotPasswordBody,
  VerifyForgotOtpBody,
  ResetPasswordBody,
} from "../types/auth.types";
import { AUTH_MESSAGES } from "../constants/messages";
import { setRefreshTokenCookie } from "../utils/cookie";

// ================================================================
// initiateRegister  POST /api/auth/register
// Step 1 — submit email, sends OTP
// ================================================================
export async function initiateRegister(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as InitiateRegisterBody;
    if (!body.email) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.EMAIL_REQUIRED });
      return;
    }
    await AuthService.initiateRegistration(body);
    res.status(200).json({ success: true, message: AUTH_MESSAGES.REGISTRATION_OTP_SENT });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.REGISTRATION_FAILED;
    res.status(400).json({ success: false, message });
  }
}

// ================================================================
// verifyRegisterOtp  POST /api/auth/verify-register-otp
// Step 2 — verify OTP
// ================================================================
export async function verifyRegisterOtp(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as VerifyRegisterOtpBody;
    if (!body.email || !body.otp) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.OTP_FIELDS_REQUIRED });
      return;
    }
    const result = await AuthService.verifyRegistrationOtp(body);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.OTP_FAILED;
    res.status(400).json({ success: false, message });
  }
}

// ================================================================
// completeRegister  POST /api/auth/complete-register
// Step 3 — set name + password, creates account, returns tokens
// ================================================================
export async function completeRegister(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CompleteRegisterBody;
    if (!body.email || !body.fullName || !body.password) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.REGISTER_FIELDS_REQUIRED });
      return;
    }
    const { user, tokens } = await AuthService.completeRegistration(body);
    setRefreshTokenCookie(res, tokens.refreshToken);
    res.status(201).json({
      success: true,
      message: AUTH_MESSAGES.REGISTRATION_COMPLETE,
      data: { user, accessToken: tokens.accessToken },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.REGISTRATION_FAILED;
    res.status(400).json({ success: false, message });
  }
}

// ================================================================
// login  POST /api/auth/login
// Email + password — returns tokens directly, no OTP
// ================================================================
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as LoginBody;
    if (!body.email || !body.password) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.EMAIL_REQUIRED });
      return;
    }
    const { user, tokens } = await AuthService.loginUser(body);
    setRefreshTokenCookie(res, tokens.refreshToken);
    res.status(200).json({
      success: true,
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      data: { user, accessToken: tokens.accessToken },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.LOGIN_FAILED;
    res.status(401).json({ success: false, message });
  }
}

// ================================================================
// refresh  POST /api/auth/refresh
// ================================================================
export function refresh(req: Request, res: Response): void {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      res.status(401).json({ success: false, message: AUTH_MESSAGES.REFRESH_TOKEN_MISSING });
      return;
    }
    const { accessToken } = AuthService.refreshAccessToken(refreshToken);
    res.status(200).json({
      success: true,
      message: AUTH_MESSAGES.TOKEN_REFRESHED,
      data: { accessToken },
    });
  } catch {
    res.status(401).json({ success: false, message: AUTH_MESSAGES.REFRESH_TOKEN_INVALID });
  }
}

// ================================================================
// logout  POST /api/auth/logout
// ================================================================
export function logout(req: Request, res: Response): void {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  if (refreshToken) AuthService.logoutUser(refreshToken);
  res.clearCookie("refreshToken");
  res.status(200).json({ success: true, message: AUTH_MESSAGES.LOGOUT_SUCCESS });
}

// ================================================================
// getMe  GET /api/auth/me  (protected)
// ================================================================
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: AUTH_MESSAGES.UNAUTHORIZED });
      return;
    }
    const user = await AuthService.getLoginById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: AUTH_MESSAGES.USER_NOT_FOUND });
      return;
    }
    res.status(200).json({ success: true, data: { user } });
  } catch {
    res.status(500).json({ success: false, message: AUTH_MESSAGES.SERVER_ERROR });
  }
}

// ================================================================
// forgotPassword  POST /api/auth/forgot-password
// ================================================================
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as ForgotPasswordBody;
    if (!body.email) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.FORGOT_PASSWORD_FIELDS_REQUIRED });
      return;
    }
    const result = await AuthService.forgotPassword(body);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.FORGOT_PASSWORD_FAILED;
    res.status(400).json({ success: false, message });
  }
}

// ================================================================
// verifyForgotOtp  POST /api/auth/verify-forgot-otp
// ================================================================
export async function verifyForgotOtp(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as VerifyForgotOtpBody;
    if (!body.email || !body.otp) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.VERIFY_FORGOT_OTP_FIELDS_REQUIRED });
      return;
    }
    const result = await AuthService.verifyForgotOtp(body);
    res.status(200).json({
      success: true,
      message: result.message,
      data: { resetToken: result.resetToken },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.FORGOT_OTP_FAILED;
    res.status(400).json({ success: false, message });
  }
}

// ================================================================
// resetPassword  POST /api/auth/reset-password
// ================================================================
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as ResetPasswordBody;
    if (!body.resetToken || !body.newPassword) {
      res.status(400).json({ success: false, message: AUTH_MESSAGES.RESET_PASSWORD_FIELDS_REQUIRED });
      return;
    }
    const result = await AuthService.resetPassword(body);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_MESSAGES.RESET_PASSWORD_FAILED;
    res.status(400).json({ success: false, message });
  }
}