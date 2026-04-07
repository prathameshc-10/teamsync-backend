// ============================================================
// src/routes/auth.routes.ts
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import * as AuthController from "../controllers/auth.controller";
import { verifyAccessToken } from "../middleware/auth.middleware";
import type { AuthRequest } from "../types/auth.types";

const router = Router();

const asHandler =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AuthRequest, res, next);

// ── Register (3 steps) ────────────────────────────────────────
router.post("/register",              AuthController.initiateRegister);   // Step 1: send OTP
router.post("/verify-register-otp",   AuthController.verifyRegisterOtp);  // Step 2: verify OTP
router.post("/complete-register",     AuthController.completeRegister);   // Step 3: set name + password

// ── Login (1 step) ────────────────────────────────────────────
router.post("/login",                 AuthController.login);

// ── Token management ──────────────────────────────────────────
router.post("/refresh",               AuthController.refresh);
router.post("/logout",                AuthController.logout);

// ── Forgot password ───────────────────────────────────────────
router.post("/forgot-password",       AuthController.forgotPassword);
router.post("/verify-forgot-otp",     AuthController.verifyForgotOtp);
router.post("/reset-password",        AuthController.resetPassword);

// ── Protected ─────────────────────────────────────────────────
router.get(
  "/me",
  asHandler(verifyAccessToken as (req: AuthRequest, res: Response, next: NextFunction) => void),
  asHandler(AuthController.getMe)
);

export default router;