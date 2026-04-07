// ============================================================
// src/types/auth.types.ts
// ============================================================

import { Request } from "express";
import { Socket } from "socket.io";

export interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Register Step 1 — submit email, triggers OTP
export interface InitiateRegisterBody {
  email: string;
}

// Register Step 2 — verify OTP
export interface VerifyRegisterOtpBody {
  email: string;
  otp: string;
}

// Register Step 3 — set name + password, creates account
export interface CompleteRegisterBody {
  email: string;
  fullName: string;
  password: string;
}

// Login — email + password directly, no OTP
export interface LoginBody {
  email: string;
  password: string;
}

// Forgot password
export interface ForgotPasswordBody {
  email: string;
}

export interface VerifyForgotOtpBody {
  email: string;
  otp: string;
}

export interface ResetPasswordBody {
  resetToken: string;
  newPassword: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface OnlineUser {
  username: string;
  socketId: string;
}

export interface SendMessagePayload {
  conversationId: number;  // Conversation.conversationId
  text: string;
}


export interface DeleteMessagePayload {
  messageId: number;       // Message.messageId
}
 
export interface EditMessagePayload {
  messageId: number;
  newText: string;
}
 
export interface ReactToMessagePayload {
  conversationId: number;
  messageId: number;
  emoji: string;
}
 
export interface TypingPayload {
  conversationId: number;
}
 
export interface SendDMPayload {
  conversationId: number;  // Conversation with type "direct"
  text: string;
}

export interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
}