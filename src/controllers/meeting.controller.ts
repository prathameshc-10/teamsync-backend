// ============================================================
// src/controllers/meeting.controller.ts
// HTTP endpoints: create meeting, get meeting info.
// Real-time events are handled by meeting.socket.ts
// ============================================================

import { Response } from "express";
import * as MeetingService from "../services/meeting.service";
import type { AuthRequest, CreateMeetingBody } from "../types/meeting.types";
import { MEETING_MESSAGES } from "../constants/messages";
import prisma from "../config/prisma";

// ================================================================
// createMeeting  POST /api/meetings
// Any authenticated user can start a meeting from a channel or DM.
// Returns the meeting link to share with others.
// ================================================================
export async function createMeeting(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: MEETING_MESSAGES.UNAUTHORIZED });
      return;
    }

    const { sourceType, sourceId } = req.body as CreateMeetingBody;

    if (!sourceType || !sourceId) {
      res.status(400).json({ success: false, message: MEETING_MESSAGES.FIELDS_REQUIRED });
      return;
    }

    if (sourceType !== "channel" && sourceType !== "dm") {
      res.status(400).json({ success: false, message: MEETING_MESSAGES.INVALID_SOURCE_TYPE });
      return;
    }

    // Fetch host's full name
    const login = await prisma.login.findUnique({
      where: { userId: req.user.userId },
    });
    if (!login) {
      res.status(404).json({ success: false, message: MEETING_MESSAGES.USER_NOT_FOUND });
      return;
    }

    const meeting = MeetingService.createMeeting(
      req.user.userId,
      login.fullName,
      sourceType,
      sourceId
    );

    res.status(201).json({
      success: true,
      message: MEETING_MESSAGES.CREATED,
      data: MeetingService.toMeetingResponse(meeting),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : MEETING_MESSAGES.CREATE_FAILED;
    res.status(500).json({ success: false, message });
  }
}

// ================================================================
// getMeeting  GET /api/meetings/:meetingId
// Returns public meeting info (status, participant count, link).
// Used by clients to validate a meeting link before joining.
// ================================================================
export async function getMeeting(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: MEETING_MESSAGES.UNAUTHORIZED });
      return;
    }

    const { meetingId } = req.params;
    const meeting = MeetingService.getMeeting(meetingId as string);

    if (!meeting) {
      res.status(404).json({ success: false, message: MEETING_MESSAGES.NOT_FOUND });
      return;
    }

    res.status(200).json({
      success: true,
      data: MeetingService.toMeetingResponse(meeting),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : MEETING_MESSAGES.FETCH_FAILED;
    res.status(500).json({ success: false, message });
  }
}

// ================================================================
// getParticipants  GET /api/meetings/:meetingId/participants
// Returns the current participant list (no socketIds exposed).
// ================================================================
export async function getParticipants(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: MEETING_MESSAGES.UNAUTHORIZED });
      return;
    }

    const { meetingId } = req.params;
    const participants = MeetingService.getParticipantList(meetingId as string);

    res.status(200).json({
      success: true,
      data: { participants },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : MEETING_MESSAGES.FETCH_FAILED;
    res.status(500).json({ success: false, message });
  }
}