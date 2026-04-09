// ============================================================
// src/types/meeting.types.ts
// ============================================================

import { Request } from "express";
import { JwtPayload } from "./auth.types";

// ── Participant roles ────────────────────────────────────────
export type MeetingRole = "HOST" | "PARTICIPANT";

// ── Participant state (in-memory, per meeting) ───────────────
export interface Participant {
  userId: number;
  fullName: string;
  socketId: string;
  role: MeetingRole;
  isMuted: boolean;
  isPresenter: boolean; // only one at a time
  joinedAt: Date;
}

// ── Meeting state (in-memory) ────────────────────────────────
export interface MeetingState {
  meetingId: string;       // uuid — also the unique join code
  meetingLink: string;     // full shareable URL
  hostUserId: number;
  sourceType: "channel" | "dm";
  sourceId: number;        // conversationId or channelId
  participants: Map<number, Participant>; // key = userId
  presenterUserId: number | null;
  chatMessages: MeetingChatMessage[];
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

// ── In-meeting chat message ──────────────────────────────────
export interface MeetingChatMessage {
  id: string;
  meetingId: string;
  senderId: number;
  senderName: string;
  content: string;
  sentAt: Date;
}

// ── HTTP request/response types ──────────────────────────────
export interface CreateMeetingBody {
  sourceType: "channel" | "dm";
  sourceId: number;
}

export interface MeetingResponse {
  meetingId: string;
  meetingLink: string;
  hostUserId: number;
  sourceType: string;
  sourceId: number;
  startedAt: Date;
  isActive: boolean;
  participantCount: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ── Socket event payloads ────────────────────────────────────

// Client → Server
export interface JoinMeetingPayload {
  meetingId: string;
  token: string; // JWT access token for socket auth
}

export interface SendChatPayload {
  meetingId: string;
  content: string;
}

export interface TransferPresenterPayload {
  meetingId: string;
  targetUserId: number;
}

export interface MuteParticipantPayload {
  meetingId: string;
  targetUserId: number;
}

export interface RemoveParticipantPayload {
  meetingId: string;
  targetUserId: number;
}

export interface WebRTCSignalPayload {
  meetingId: string;
  targetUserId: number;
  signal: unknown; // SDP offer/answer or ICE candidate
}

export interface PresenterActionPayload {
  meetingId: string;
  action: "start" | "stop"; // start/stop screen share
}

// Server → Client
export interface MeetingJoinedPayload {
  meetingId: string;
  meetingLink: string;
  you: Omit<Participant, "socketId">;
  participants: Omit<Participant, "socketId">[];
  presenterUserId: number | null;
  chatHistory: MeetingChatMessage[];
}

export interface ParticipantJoinedPayload {
  participant: Omit<Participant, "socketId">;
}

export interface ParticipantLeftPayload {
  userId: number;
  fullName: string;
}

export interface PresenterChangedPayload {
  presenterUserId: number | null;
  presenterName: string | null;
}

export interface ParticipantMutedPayload {
  userId: number;
  isMuted: boolean;
  byHost: boolean;
}

export interface MeetingEndedPayload {
  meetingId: string;
  endedAt: Date;
}

export interface ChatMessagePayload {
  message: MeetingChatMessage;
}

export interface ErrorPayload {
  message: string;
}