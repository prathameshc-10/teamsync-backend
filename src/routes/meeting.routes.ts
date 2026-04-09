// ============================================================
// src/routes/meeting.routes.ts
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import * as MeetingController from "../controllers/meeting.controller";
import { verifyAccessToken } from "../middleware/auth.middleware";
import type { AuthRequest } from "../types/meeting.types";

const router = Router();

const asHandler =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AuthRequest, res, next);

const auth = asHandler(
  verifyAccessToken as (req: AuthRequest, res: Response, next: NextFunction) => void
);

// POST /api/meetings             — start a new meeting
// GET  /api/meetings/:meetingId  — get meeting info (validate link)
// GET  /api/meetings/:meetingId/participants — get participant list

router.post("/",                              auth, asHandler(MeetingController.createMeeting));
router.get("/:meetingId",                     auth, asHandler(MeetingController.getMeeting));
router.get("/:meetingId/participants",        auth, asHandler(MeetingController.getParticipants));

export default router;