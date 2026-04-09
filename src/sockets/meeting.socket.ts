// ============================================================
// src/sockets/meeting.socket.ts
// All real-time meeting events handled here via Socket.IO.
//
// Socket room strategy:
//   Each meeting gets its own room: `meeting:<meetingId>`
//   All events are broadcast within that room only.
// ============================================================

import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/jwt.config";
import * as MeetingService from "../services/meeting.service";
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

// ── Socket event names ───────────────────────────────────────
export const MEETING_EVENTS = {
  // Client → Server
  JOIN:               "meeting:join",
  LEAVE:              "meeting:leave",
  END:                "meeting:end",
  SEND_CHAT:          "meeting:chat:send",
  TRANSFER_PRESENTER: "meeting:presenter:transfer",
  PRESENTER_ACTION:   "meeting:presenter:action",  // start/stop screen share
  MUTE_PARTICIPANT:   "meeting:mute:participant",
  MUTE_ALL:           "meeting:mute:all",
  TOGGLE_SELF_MUTE:   "meeting:mute:self",
  REMOVE_PARTICIPANT: "meeting:remove:participant",
  WEBRTC_SIGNAL:      "meeting:webrtc:signal",     // relay SDP/ICE

  // Server → Client
  JOINED:             "meeting:joined",
  PARTICIPANT_JOINED: "meeting:participant:joined",
  PARTICIPANT_LEFT:   "meeting:participant:left",
  PARTICIPANT_REMOVED:"meeting:participant:removed",
  PRESENTER_CHANGED:  "meeting:presenter:changed",
  PARTICIPANT_MUTED:  "meeting:participant:muted",
  ALL_MUTED:          "meeting:all:muted",
  CHAT_MESSAGE:       "meeting:chat:message",
  ENDED:              "meeting:ended",
  WEBRTC_SIGNAL_RECV: "meeting:webrtc:signal:recv", // forwarded signal
  ERROR:              "meeting:error",
  SCREEN_SHARE_STARTED: "meeting:screenshare:started",
  SCREEN_SHARE_STOPPED: "meeting:screenshare:stopped",
} as const;

// ── Helper: room name for a meeting ─────────────────────────
function roomName(meetingId: string): string {
  return `meeting:${meetingId}`;
}

// ── Helper: verify JWT from socket handshake ─────────────────
function verifySocketToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET) as JwtPayload;
}

// ── Helper: emit error to single socket ─────────────────────
function emitError(socket: Socket, message: string): void {
  socket.emit(MEETING_EVENTS.ERROR, { message });
}

// ================================================================
// registerMeetingSocketHandlers
// Call this once per connected socket in your main socket setup.
// ================================================================
export function registerMeetingSocketHandlers(
  io: SocketServer,
  socket: Socket
): void {

  // ============================================================
  // meeting:join
  // Client sends JWT + meetingId to join.
  // ============================================================
  socket.on(MEETING_EVENTS.JOIN, async (payload: JoinMeetingPayload) => {
    try {
      const { meetingId, token } = payload;

      // Auth
      let decoded: JwtPayload;
      try {
        decoded = verifySocketToken(token);
      } catch {
        return emitError(socket, "Unauthorized: invalid token");
      }

      // Fetch user's fullName from DB
      const login = await prisma.login.findUnique({
        where: { userId: decoded.userId },
      });
      if (!login) return emitError(socket, "User not found");

      // Join meeting state
      const { meeting, participant } = MeetingService.joinMeeting(
        meetingId,
        decoded.userId,
        login.fullName,
        socket.id
      );

      // Join socket room
      socket.join(roomName(meetingId));

      // Store context on socket for later events
      (socket as any)._meetingId = meetingId;
      (socket as any)._userId = decoded.userId;

      // Send full meeting state to the joiner
      socket.emit(MEETING_EVENTS.JOINED, {
        meetingId: meeting.meetingId,
        meetingLink: meeting.meetingLink,
        you: { ...participant, socketId: undefined },
        participants: MeetingService.getParticipantList(meetingId),
        presenterUserId: meeting.presenterUserId,
        chatHistory: meeting.chatMessages,
      });

      // Notify everyone else in the room
      socket.to(roomName(meetingId)).emit(MEETING_EVENTS.PARTICIPANT_JOINED, {
        participant: { ...participant, socketId: undefined },
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to join meeting");
    }
  });

  // ============================================================
  // meeting:leave
  // Participant voluntarily leaves.
  // ============================================================
  socket.on(MEETING_EVENTS.LEAVE, () => {
    handleLeave(io, socket);
  });

  // ============================================================
  // meeting:end
  // Host ends the meeting for everyone.
  // ============================================================
  socket.on(MEETING_EVENTS.END, () => {
    try {
      const meetingId: string = (socket as any)._meetingId;
      const userId: number = (socket as any)._userId;
      if (!meetingId || !userId) return emitError(socket, "Not in a meeting");

      const meeting = MeetingService.endMeeting(meetingId, userId);

      // Notify all in room
      io.to(roomName(meetingId)).emit(MEETING_EVENTS.ENDED, {
        meetingId,
        endedAt: meeting.endedAt,
      });

      // Disconnect all sockets from this room
      io.in(roomName(meetingId)).socketsLeave(roomName(meetingId));

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to end meeting");
    }
  });

  // ============================================================
  // meeting:chat:send
  // Any participant sends a chat message.
  // ============================================================
  socket.on(MEETING_EVENTS.SEND_CHAT, (payload: SendChatPayload) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const message = MeetingService.sendChatMessage(
        payload.meetingId,
        userId,
        payload.content
      );

      // Broadcast to everyone in the meeting including sender
      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.CHAT_MESSAGE, {
        message,
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to send message");
    }
  });

  // ============================================================
  // meeting:presenter:transfer
  // Host transfers presenter role to another participant.
  // ============================================================
  socket.on(MEETING_EVENTS.TRANSFER_PRESENTER, (payload: TransferPresenterPayload) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const { meeting, newPresenter } = MeetingService.transferPresenter(
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

  // ============================================================
  // meeting:presenter:action
  // Presenter starts or stops screen sharing.
  // ============================================================
  socket.on(MEETING_EVENTS.PRESENTER_ACTION, (payload: PresenterActionPayload) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      let meeting;
      if (payload.action === "start") {
        meeting = MeetingService.startScreenShare(payload.meetingId, userId);
        const presenter = meeting.participants.get(userId);
        io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PRESENTER_CHANGED, {
          presenterUserId: userId,
          presenterName: presenter?.fullName ?? null,
        });
      } else {
        meeting = MeetingService.stopScreenShare(payload.meetingId, userId);
        io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PRESENTER_CHANGED, {
          presenterUserId: null,
          presenterName: null,
        });
      }

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to update screen share");
    }
  });

  // ============================================================
  // meeting:mute:self
  // Participant toggles their own mute state.
  // ============================================================
  socket.on(MEETING_EVENTS.TOGGLE_SELF_MUTE, () => {
    try {
      const meetingId: string = (socket as any)._meetingId;
      const userId: number = (socket as any)._userId;
      if (!meetingId || !userId) return emitError(socket, "Not in a meeting");

      const participant = MeetingService.toggleSelfMute(meetingId, userId);

      io.to(roomName(meetingId)).emit(MEETING_EVENTS.PARTICIPANT_MUTED, {
        userId,
        isMuted: participant.isMuted,
        byHost: false,
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to toggle mute");
    }
  });

  // ============================================================
  // meeting:mute:participant
  // Host mutes a specific participant.
  // ============================================================
  socket.on(MEETING_EVENTS.MUTE_PARTICIPANT, (payload: MuteParticipantPayload) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const target = MeetingService.muteParticipant(
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

  // ============================================================
  // meeting:mute:all
  // Host mutes everyone.
  // ============================================================
  socket.on(MEETING_EVENTS.MUTE_ALL, (payload: { meetingId: string }) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const muted = MeetingService.muteAll(payload.meetingId, userId);

      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.ALL_MUTED, {
        mutedUserIds: muted.map((p) => p.userId),
        byHost: true,
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to mute all");
    }
  });

  // ============================================================
  // meeting:remove:participant
  // Host removes a participant from the meeting.
  // ============================================================
  socket.on(MEETING_EVENTS.REMOVE_PARTICIPANT, (payload: RemoveParticipantPayload) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const removed = MeetingService.removeParticipant(
        payload.meetingId,
        userId,
        payload.targetUserId
      );

      // Tell the removed socket to leave the room
      const removedSocket = findSocketByUserId(io, payload.meetingId, removed.socketId);
      if (removedSocket) {
        removedSocket.emit(MEETING_EVENTS.PARTICIPANT_REMOVED, {
          userId: removed.userId,
          reason: "Removed by host",
        });
        removedSocket.leave(roomName(payload.meetingId));
      }

      // Notify remaining participants
      io.to(roomName(payload.meetingId)).emit(MEETING_EVENTS.PARTICIPANT_LEFT, {
        userId: removed.userId,
        fullName: removed.fullName,
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Failed to remove participant");
    }
  });

  // ============================================================
  // meeting:webrtc:signal
  // Relay WebRTC SDP offers/answers and ICE candidates between peers.
  // The server acts as a signaling relay only — no media processing.
  // ============================================================
  socket.on(MEETING_EVENTS.WEBRTC_SIGNAL, (payload: WebRTCSignalPayload) => {
    try {
      const userId: number = (socket as any)._userId;
      if (!userId) return emitError(socket, "Not authenticated");

      const meeting = MeetingService.getMeeting(payload.meetingId);
      if (!meeting) return emitError(socket, "Meeting not found");

      const targetParticipant = meeting.participants.get(payload.targetUserId);
      if (!targetParticipant) return emitError(socket, "Target participant not found");

      // Forward signal directly to the target peer
      io.to(targetParticipant.socketId).emit(MEETING_EVENTS.WEBRTC_SIGNAL_RECV, {
        fromUserId: userId,
        signal: payload.signal,
      });

    } catch (err) {
      emitError(socket, err instanceof Error ? err.message : "Signal relay failed");
    }
  });

  // ============================================================
  // disconnect
  // Clean up when socket drops unexpectedly.
  // ============================================================
  socket.on("disconnect", () => {
    handleLeave(io, socket);
  });
}

// ================================================================
// handleLeave — shared logic for leave + disconnect
// ================================================================
function handleLeave(io: SocketServer, socket: Socket): void {
  try {
    const meetingId: string = (socket as any)._meetingId;
    const userId: number = (socket as any)._userId;
    if (!meetingId || !userId) return;

    const { meeting, ended } = MeetingService.leaveMeeting(meetingId, userId);
    socket.leave(roomName(meetingId));

    if (ended) {
      // Host left — notify everyone the meeting is over
      io.to(roomName(meetingId)).emit(MEETING_EVENTS.ENDED, {
        meetingId,
        endedAt: meeting.endedAt,
      });
      io.in(roomName(meetingId)).socketsLeave(roomName(meetingId));
    } else {
      // Regular participant left
      socket.to(roomName(meetingId)).emit(MEETING_EVENTS.PARTICIPANT_LEFT, {
        userId,
        fullName: meeting.participants.get(userId)?.fullName ?? "",
      });
    }

  } catch {
    // Participant may have already been removed — ignore silently
  }
}

// ================================================================
// findSocketByUserId — look up a socket instance by socketId
// ================================================================
function findSocketByUserId(
  io: SocketServer,
  meetingId: string,
  socketId: string
): Socket | undefined {
  return io.sockets.sockets.get(socketId);
}