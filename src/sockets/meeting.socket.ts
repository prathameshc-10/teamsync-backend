// ============================================================
// src/sockets/meeting.socket.ts
// ============================================================

import { Server as SocketServer, Socket } from "socket.io";

import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/jwt.config";
import * as MeetingService from "../services/meeting.service";
import * as OrgService from "../services/organization.services";
import type { JwtPayload } from "../types/auth.types";
import type {
  JoinMeetingPayload,
  SendChatPayload,
  TransferPresenterPayload,
  MuteParticipantPayload,
  RemoveParticipantPayload,
  WebRTCSignalPayload,
  PresenterActionPayload,
} from "../types/meeting.types";
import prisma from "../config/prisma";

// ── Extend socket type to avoid (socket as any) ──────────────
interface MeetingSocket extends Socket {
  _meetingId?: string;
  _userId?: number;
  _fullName?: string; // FIX: store fullName so handleLeave can use it after removal
}

// ── Socket event names ───────────────────────────────────────
export const MEETING_EVENTS = {
  // Client → Server
  JOIN:                 "meeting:join",
  LEAVE:                "meeting:leave",
  END:                  "meeting:end",
  SEND_CHAT:            "meeting:chat:send",
  TRANSFER_PRESENTER:   "meeting:presenter:transfer",
  PRESENTER_ACTION:     "meeting:presenter:action",
  MUTE_PARTICIPANT:     "meeting:mute:participant",
  MUTE_ALL:             "meeting:mute:all",
  TOGGLE_SELF_MUTE:     "meeting:mute:self",
  REMOVE_PARTICIPANT:   "meeting:remove:participant",
  WEBRTC_SIGNAL:        "meeting:webrtc:signal",

  // Server → Client
  JOINED:               "meeting:joined",
  PARTICIPANT_JOINED:   "meeting:participant:joined",
  PARTICIPANT_LEFT:     "meeting:participant:left",
  PARTICIPANT_REMOVED:  "meeting:participant:removed",
  PRESENTER_CHANGED:    "meeting:presenter:changed",
  PARTICIPANT_MUTED:    "meeting:participant:muted",
  ALL_MUTED:            "meeting:all:muted",
  CHAT_MESSAGE:         "meeting:chat:message",
  ENDED:                "meeting:ended",
  WEBRTC_SIGNAL_RECV:   "meeting:webrtc:signal:recv",
  ERROR:                "meeting:error",

  // FIX: these were defined but never emitted — now properly fired
  SCREEN_SHARE_STARTED: "meeting:screenshare:started",
  SCREEN_SHARE_STOPPED: "meeting:screenshare:stopped",
} as const;

function roomName(meetingId: string): string {
  return `meeting:${meetingId}`;
}

function verifySocketToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET) as JwtPayload;
}

function emitError(socket: Socket, message: string): void {
  socket.emit(MEETING_EVENTS.ERROR, { message });
}

async function postOrgMeetingEndedMessage(meetingId: string): Promise<void> {
  const meeting = await MeetingService.getMeeting(meetingId);
  if (!meeting || meeting.sourceType !== "channel") return;

  const organization = await prisma.organization.findUnique({
    where: { orgId: meeting.sourceId },
    select: { orgName: true },
  });

  const content = `MEETING_ENDED::${JSON.stringify({
    meetingId,
    orgName: organization?.orgName ?? null,
  })}`;

  await OrgService.sendOrgChatMessage(meeting.sourceId, meeting.hostUserId, content);
}

// ============================================================
// registerMeetingSocketHandlers
// ============================================================
export function registerMeetingSocketHandlers(
  io: SocketServer,
  socket: MeetingSocket
): void {

  // ── meeting:join ──────────────────────────────────────────
  socket.on(MEETING_EVENTS.JOIN, async (payload: JoinMeetingPayload) => {
    try {
      const { meetingId, token } = payload;

      let decoded: JwtPayload;
      try {
        decoded = verifySocketToken(token);
      } catch {
        return emitError(socket, "Unauthorized: invalid token");
      }

      const login = await prisma.login.findUnique({
        where: { userId: decoded.userId },
      });
      if (!login) return emitError(socket, "User not found");

      const { meeting, participant } = await MeetingService.joinMeeting(
        meetingId,
        decoded.userId,
        login.fullName,
        socket.id
      );

      socket.join(roomName(meetingId));

      // Store on socket — using proper typed interface now
      socket._meetingId = meetingId;
      socket._userId    = decoded.userId;
      socket._fullName  = login.fullName; // FIX: store so handleLeave can use it

      socket.emit(MEETING_EVENTS.JOINED, {
        meetingId: meeting.meetingId,
        meetingLink: meeting.meetingLink,
        you: { ...participant, socketId: undefined },
        participants: await MeetingService.getParticipantList(meetingId),
        presenterUserId: meeting.presenterUserId,
        chatHistory: meeting.chatMessages,
      });

      socket.to(roomName(meetingId)).emit(MEETING_EVENTS.PARTICIPANT_JOINED, {
        participant: { ...participant, socketId: undefined },
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to join meeting");
    }
  });

  // ── meeting:leave ─────────────────────────────────────────
  socket.on(MEETING_EVENTS.LEAVE, () => {
    void handleLeave(io, socket);
  });

  // ── meeting:end ───────────────────────────────────────────
  socket.on(MEETING_EVENTS.END, async () => {
    try {
      const { _meetingId: meetingId, _userId: userId } = socket;
      if (!meetingId || !userId) return emitError(socket, "Not in a meeting");

      const meeting = await MeetingService.endMeeting(meetingId, userId);
      await postOrgMeetingEndedMessage(meetingId);

      io.to(roomName(meetingId)).emit(MEETING_EVENTS.ENDED, {
        meetingId,
        endedAt: meeting.endedAt,
      });

      io.in(roomName(meetingId)).socketsLeave(roomName(meetingId));
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to end meeting");
    }
  });

  // ── meeting:chat:send ─────────────────────────────────────
  socket.on(MEETING_EVENTS.SEND_CHAT, async (payload: SendChatPayload) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const message = await MeetingService.sendChatMessage(
        payload.meetingId,
        userId,
        payload.content
      );

      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.CHAT_MESSAGE, {
        message,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to send message");
    }
  });

  // ── meeting:presenter:transfer ────────────────────────────
  socket.on(MEETING_EVENTS.TRANSFER_PRESENTER, async (payload: TransferPresenterPayload) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const { meeting, newPresenter } = await MeetingService.transferPresenter(
        payload.meetingId,
        userId,
        payload.targetUserId
      );

      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PRESENTER_CHANGED, {
        presenterUserId: meeting.presenterUserId,
        presenterName: newPresenter.fullName,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to transfer presenter");
    }
  });

  // ── meeting:presenter:action (screen share) ───────────────
  // FIX: now emits SCREEN_SHARE_STARTED / SCREEN_SHARE_STOPPED
  // in addition to PRESENTER_CHANGED so clients can react to
  // both the role change and the screen share state separately.
  socket.on(MEETING_EVENTS.PRESENTER_ACTION, async (payload: PresenterActionPayload) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      if (payload.action === "start") {
        const meeting = await MeetingService.startScreenShare(payload.meetingId, userId);
        const presenter = meeting.participants.get(userId);

        // Tell everyone the presenter role changed
        io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PRESENTER_CHANGED, {
          presenterUserId: userId,
          presenterName: presenter?.fullName ?? null,
        });

        // Tell everyone screen share has started
        io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.SCREEN_SHARE_STARTED, {
          screenShareUserId: userId,
          screenShareUserName: presenter?.fullName ?? null,
        });

      } else {
        const meeting = await MeetingService.stopScreenShare(payload.meetingId, userId);
        const stoppedBy = meeting.participants.get(userId);

        // Tell everyone presenter is cleared
        io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PRESENTER_CHANGED, {
          presenterUserId: null,
          presenterName: null,
        });

        // Tell everyone screen share has stopped
        io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.SCREEN_SHARE_STOPPED, {
          stoppedByUserId: userId,
          stoppedByUserName: stoppedBy?.fullName ?? null,
        });
      }
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to update screen share");
    }
  });

  // ── meeting:mute:self ─────────────────────────────────────
  socket.on(MEETING_EVENTS.TOGGLE_SELF_MUTE, async () => {
    try {
      const { _meetingId: meetingId, _userId: userId } = socket;
      if (!meetingId || !userId) return emitError(socket, "Not in a meeting");

      const participant = await MeetingService.toggleSelfMute(meetingId, userId);

      io.to(roomName(meetingId)).emit(MEETING_EVENTS.PARTICIPANT_MUTED, {
        userId,
        isMuted: participant.isMuted,
        byHost: false,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to toggle mute");
    }
  });

  // ── meeting:mute:participant ──────────────────────────────
  socket.on(MEETING_EVENTS.MUTE_PARTICIPANT, async (payload: MuteParticipantPayload) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const target = await MeetingService.muteParticipant(
        payload.meetingId,
        userId,
        payload.targetUserId
      );

      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PARTICIPANT_MUTED, {
        userId: target.userId,
        isMuted: true,
        byHost: true,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to mute participant");
    }
  });

  // ── meeting:mute:all ──────────────────────────────────────
  socket.on(MEETING_EVENTS.MUTE_ALL, async (payload: { meetingId: string }) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const muted = await MeetingService.muteAll(payload.meetingId, userId);

      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.ALL_MUTED, {
        mutedUserIds: muted.map((p) => p.userId),
        byHost: true,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to mute all");
    }
  });

  // ── meeting:remove:participant ────────────────────────────
  socket.on(MEETING_EVENTS.REMOVE_PARTICIPANT, async (payload: RemoveParticipantPayload) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const removed = await MeetingService.removeParticipant(
        payload.meetingId,
        userId,
        payload.targetUserId
      );

      const removedSocket = io.sockets.sockets.get(removed.socketId);
      if (removedSocket) {
        removedSocket.emit(MEETING_EVENTS.PARTICIPANT_REMOVED, {
          userId: removed.userId,
          reason: "Removed by host",
        });
        removedSocket.leave(roomName(payload.meetingId));
      }

      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PARTICIPANT_LEFT, {
        userId: removed.userId,
        fullName: removed.fullName,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to remove participant");
    }
  });

  // ── meeting:webrtc:signal ─────────────────────────────────
  socket.on(MEETING_EVENTS.WEBRTC_SIGNAL, async (payload: WebRTCSignalPayload) => {
    try {
      const userId = socket._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const meeting = await MeetingService.getMeeting(payload.meetingId);
      if (!meeting) return emitError(socket, "Meeting not found");

      const targetParticipant = meeting.participants.get(payload.targetUserId);
      if (!targetParticipant) return emitError(socket, "Target participant not found");

      io.to(targetParticipant.socketId).emit(MEETING_EVENTS.WEBRTC_SIGNAL_RECV, {
        fromUserId: userId,
        signal: payload.signal,
      });
    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Signal relay failed");
    }
  });

  // ── disconnect ────────────────────────────────────────────
  // FIX: only handle meeting cleanup if socket was actually in a meeting
  // prevents double-disconnect conflict with socketHandler.ts
  socket.on("disconnect", () => {
    if (socket._meetingId) {
      void handleLeave(io, socket);
    }
  });
}

// ============================================================
// handleLeave
// ============================================================
async function handleLeave(io: SocketServer, socket: MeetingSocket): Promise<void> {
  try {
    const meetingId = socket._meetingId;
    const userId    = socket._userId;
    const fullName  = socket._fullName; // FIX: read before leaveMeeting removes them from map

    if (!meetingId || !userId) return;

    const { meeting, ended } = await MeetingService.leaveMeeting(meetingId, userId);
    socket.leave(roomName(meetingId));

    // Clear socket state
    socket._meetingId = undefined;
    socket._userId    = undefined;
    socket._fullName  = undefined;

    if (ended) {
      await postOrgMeetingEndedMessage(meetingId);

      io.to(roomName(meetingId)).emit(MEETING_EVENTS.ENDED, {
        meetingId,
        endedAt: meeting.endedAt,
      });
      io.in(roomName(meetingId)).socketsLeave(roomName(meetingId));
    } else {
      // FIX: use stored fullName instead of looking up from map
      // (participant is already removed from map by leaveMeeting)
      socket.to(roomName(meetingId)).emit(MEETING_EVENTS.PARTICIPANT_LEFT, {
        userId,
        fullName: fullName ?? "",
      });
    }
  } catch {
    // Participant may have already been removed — ignore
  }
}