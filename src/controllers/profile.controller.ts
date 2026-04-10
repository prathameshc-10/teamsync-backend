import { Response } from "express";
import * as ProfileService from "../services/profile.service";
import type { AuthRequest } from "../types/auth.types";
import type { UpdateProfileBody, ChangePasswordBody } from "../types/profile.types";

// ================================================================
// getProfile  GET /api/profile
// ================================================================
export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const profile = await ProfileService.getProfile(req.user.userId);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    res.status(500).json({ success: false, message });
  }
}

// ================================================================
// updateProfile  PATCH /api/profile
// ================================================================
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const body = req.body as UpdateProfileBody;
    if (!body.fullName || !body.email) {
      res.status(400).json({ success: false, message: "fullName and email are required" });
      return;
    }

    const updated = await ProfileService.updateProfile(req.user.userId, body);
    res.status(200).json({ success: true, message: "Profile updated successfully", data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    res.status(400).json({ success: false, message });
  }
}

// ================================================================
// changePassword  PATCH /api/profile/password
// ================================================================
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const body = req.body as ChangePasswordBody;
    if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
      res.status(400).json({ success: false, message: "All password fields are required" });
      return;
    }

    await ProfileService.changePassword(req.user.userId, body);
    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to change password";
    res.status(400).json({ success: false, message });
  }
}