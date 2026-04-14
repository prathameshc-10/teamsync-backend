// ============================================================
// src/services/meeting.service.ts
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type {
  MeetingState,
  Participant,
  MeetingChatMessage,
  MeetingResponse,
} from "../types/meeting.types";
import { MEETING_MESSAGES } from "../constants/messages";
import prisma from "../config/prisma";

// Runtime-only data for active socket sessions.
// Persistent meeting existence/status is stored in PostgreSQL via Prisma.
const meetings: Map<string, MeetingState> = new Map();

const BASE_URL = process.env.APP_BASE_URL || "https://localhost:3000";

// ================================================================
// createMeeting
// Called when a user starts a meeting from a channel or DM.
// ================================================================
function createRuntimeMeetingState(
  meetingId: string,
  hostUserId: number,
  hostFullName: string,
  sourceType: "channel" | "dm",
  sourceId: number,
  startedAt: Date,
  hostSocketId: string = ""
): MeetingState {
  const meetingLink = `${BASE_URL}/meeting/${meetingId}`;

  const hostParticipant: Participant = {
    userId: hostUserId,
    fullName: hostFullName,
    socketId: hostSocketId,
    role: "HOST",
    isMuted: false,
    isPresenter: false,
    joinedAt: new Date(),
  };

  return {
    meetingId,
    meetingLink,
    hostUserId,
    sourceType,
    sourceId,
    participants: new Map([[hostUserId, hostParticipant]]),
    presenterUserId: null,
    chatMessages: [],
    startedAt,
    isActive: true,
  };
}

async function hydrateMeetingFromDb(meetingId: string): Promise<MeetingState | null> {
  const persisted = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      host: {
        select: { fullName: true },
      },
    },
  });

  if (!persisted) {
    return null;
  }

  const state: MeetingState = {
    meetingId: persisted.id,
    meetingLink: `${BASE_URL}/meeting/${persisted.id}`,
    hostUserId: persisted.hostUserId,
    sourceType: persisted.sourceType as "channel" | "dm",
    sourceId: persisted.sourceId,
    participants: new Map(),
    presenterUserId: null,
    chatMessages: [],
    startedAt: persisted.createdAt,
    endedAt: persisted.endedAt ?? undefined,
    isActive: persisted.status === "active",
  };

  if (state.isActive) {
    const hostParticipant: Participant = {
      userId: persisted.hostUserId,
      fullName: persisted.host.fullName,
      socketId: "",
      role: "HOST",
      isMuted: false,
      isPresenter: false,
      joinedAt: persisted.createdAt,
    };
    state.participants.set(persisted.hostUserId, hostParticipant);
  }

  meetings.set(persisted.id, state);
  return state;
}

export async function createMeeting(
  hostUserId: number,
  hostFullName: string,
  sourceType: "channel" | "dm",
  sourceId: number,
  hostSocketId: string = ""
): Promise<MeetingState> {
  const persisted = await prisma.meeting.create({
    data: {
      hostUserId,
      sourceType,
      sourceId,
      status: "active",
    },
  });

  const state = createRuntimeMeetingState(
    persisted.id,
    hostUserId,
    hostFullName,
    sourceType,
    sourceId,
    persisted.createdAt,
    hostSocketId
  );

  meetings.set(persisted.id, state);
  return state;
}

// ================================================================
// getMeeting
// ================================================================
export async function getMeeting(meetingId: string): Promise<MeetingState | null> {
  const runtime = meetings.get(meetingId);
  if (runtime) {
    return runtime;
  }

  return hydrateMeetingFromDb(meetingId);
}

// ================================================================
// getMeetingOrThrow
// ================================================================
export async function getMeetingOrThrow(meetingId: string): Promise<MeetingState> {
  const meeting = await getMeeting(meetingId);
  if (!meeting) throw new Error(MEETING_MESSAGES.NOT_FOUND);
  if (!meeting.isActive) throw new Error(MEETING_MESSAGES.ENDED);
  return meeting;
}

// ================================================================
// joinMeeting
// Adds a participant to an existing active meeting.
// ================================================================
export async function joinMeeting(
  meetingId: string,
  userId: number,
  fullName: string,
  socketId: string
): Promise<{ meeting: MeetingState; participant: Participant }> {
  const meeting = await getMeetingOrThrow(meetingId);

  // If already in the meeting (reconnect), update socket id
  const existing = meeting.participants.get(userId);
  if (existing) {
    existing.socketId = socketId;
    return { meeting, participant: existing };
  }

  const participant: Participant = {
    userId,
    fullName,
    socketId,
    role: "PARTICIPANT",
    isMuted: false,
    isPresenter: false,
    joinedAt: new Date(),
  };

  meeting.participants.set(userId, participant);
  return { meeting, participant };
}

// ================================================================
// leaveMeeting
// Removes a participant. If host leaves, ends the meeting.
// ================================================================
export async function leaveMeeting(
  meetingId: string,
  userId: number
): Promise<{ meeting: MeetingState; ended: boolean }> {
  const meeting = await getMeetingOrThrow(meetingId);
  const participant = meeting.participants.get(userId);

  if (!participant) throw new Error(MEETING_MESSAGES.NOT_PARTICIPANT);

  // Clear presenter if this person was presenting
  if (meeting.presenterUserId === userId) {
    meeting.presenterUserId = null;
  }

  meeting.participants.delete(userId);

  // If the host leaves, end the meeting for everyone
  if (userId === meeting.hostUserId) {
    meeting.isActive = false;
    meeting.endedAt = new Date();
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: "ended",
        endedAt: meeting.endedAt,
      },
    });
    return { meeting, ended: true };
  }

  return { meeting, ended: false };
}

// ================================================================
// endMeeting
// Host explicitly ends the meeting.
// ================================================================
export async function endMeeting(meetingId: string, requestingUserId: number): Promise<MeetingState> {
  const meeting = await getMeetingOrThrow(meetingId);

  if (meeting.hostUserId !== requestingUserId) {
    throw new Error(MEETING_MESSAGES.HOST_ONLY);
  }

  meeting.isActive = false;
  meeting.endedAt = new Date();
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "ended",
      endedAt: meeting.endedAt,
    },
  });
  return meeting;
}

// ================================================================
// transferPresenter
// Host transfers presenter control to another participant.
// ================================================================
export async function transferPresenter(
  meetingId: string,
  requestingUserId: number,
  targetUserId: number
): Promise<{ meeting: MeetingState; newPresenter: Participant }> {
  const meeting = await getMeetingOrThrow(meetingId);

  if (meeting.hostUserId !== requestingUserId) {
    throw new Error(MEETING_MESSAGES.HOST_ONLY);
  }

  const target = meeting.participants.get(targetUserId);
  if (!target) throw new Error(MEETING_MESSAGES.PARTICIPANT_NOT_FOUND);

  // Clear previous presenter
  if (meeting.presenterUserId !== null) {
    const prev = meeting.participants.get(meeting.presenterUserId);
    if (prev) prev.isPresenter = false;
  }

  target.isPresenter = true;
  meeting.presenterUserId = targetUserId;

  return { meeting, newPresenter: target };
}

// ================================================================
// startScreenShare
// Only the current presenter (or host assigning themselves) can share.
// ================================================================
export async function startScreenShare(
  meetingId: string,
  requestingUserId: number
): Promise<MeetingState> {
  const meeting = await getMeetingOrThrow(meetingId);

  const requester = meeting.participants.get(requestingUserId);
  if (!requester) throw new Error(MEETING_MESSAGES.NOT_PARTICIPANT);

  // Only the designated presenter OR the host can start sharing
  const isHost = meeting.hostUserId === requestingUserId;
  const isPresenter = meeting.presenterUserId === requestingUserId;

  if (!isHost && !isPresenter) {
    throw new Error(MEETING_MESSAGES.PRESENTER_ONLY);
  }

  // If someone else is currently sharing, stop them
  if (meeting.presenterUserId !== null && meeting.presenterUserId !== requestingUserId) {
    const prev = meeting.participants.get(meeting.presenterUserId);
    if (prev) prev.isPresenter = false;
  }

  requester.isPresenter = true;
  meeting.presenterUserId = requestingUserId;

  return meeting;
}

// ================================================================
// stopScreenShare
// Presenter stops sharing — clears presenter slot.
// ================================================================
export async function stopScreenShare(
  meetingId: string,
  requestingUserId: number
): Promise<MeetingState> {
  const meeting = await getMeetingOrThrow(meetingId);

  if (meeting.presenterUserId !== requestingUserId) {
    throw new Error(MEETING_MESSAGES.NOT_PRESENTER);
  }

  const presenter = meeting.participants.get(requestingUserId);
  if (presenter) presenter.isPresenter = false;
  meeting.presenterUserId = null;

  return meeting;
}

// ================================================================
// muteParticipant
// Host mutes a specific participant.
// ================================================================
export async function muteParticipant(
  meetingId: string,
  requestingUserId: number,
  targetUserId: number
): Promise<Participant> {
  const meeting = await getMeetingOrThrow(meetingId);

  if (meeting.hostUserId !== requestingUserId) {
    throw new Error(MEETING_MESSAGES.HOST_ONLY);
  }

  const target = meeting.participants.get(targetUserId);
  if (!target) throw new Error(MEETING_MESSAGES.PARTICIPANT_NOT_FOUND);

  target.isMuted = true;
  return target;
}

// ================================================================
// muteAll
// Host mutes every participant (not themselves).
// ================================================================
export async function muteAll(
  meetingId: string,
  requestingUserId: number
): Promise<Participant[]> {
  const meeting = await getMeetingOrThrow(meetingId);

  if (meeting.hostUserId !== requestingUserId) {
    throw new Error(MEETING_MESSAGES.HOST_ONLY);
  }

  const muted: Participant[] = [];
  meeting.participants.forEach((p) => {
    if (p.userId !== requestingUserId) {
      p.isMuted = true;
      muted.push(p);
    }
  });

  return muted;
}

// ================================================================
// toggleSelfMute
// Any participant mutes/unmutes themselves.
// ================================================================
export async function toggleSelfMute(
  meetingId: string,
  userId: number
): Promise<Participant> {
  const meeting = await getMeetingOrThrow(meetingId);

  const participant = meeting.participants.get(userId);
  if (!participant) throw new Error(MEETING_MESSAGES.NOT_PARTICIPANT);

  participant.isMuted = !participant.isMuted;
  return participant;
}

// ================================================================
// removeParticipant
// Host removes a participant from the meeting.
// ================================================================
export async function removeParticipant(
  meetingId: string,
  requestingUserId: number,
  targetUserId: number
): Promise<Participant> {
  const meeting = await getMeetingOrThrow(meetingId);

  if (meeting.hostUserId !== requestingUserId) {
    throw new Error(MEETING_MESSAGES.HOST_ONLY);
  }

  if (targetUserId === requestingUserId) {
    throw new Error(MEETING_MESSAGES.CANNOT_REMOVE_SELF);
  }

  const target = meeting.participants.get(targetUserId);
  if (!target) throw new Error(MEETING_MESSAGES.PARTICIPANT_NOT_FOUND);

  // Clear presenter if removed participant was presenting
  if (meeting.presenterUserId === targetUserId) {
    meeting.presenterUserId = null;
  }

  meeting.participants.delete(targetUserId);
  return target;
}

// ================================================================
// sendChatMessage
// Any participant sends a message to the in-meeting chat sidebar.
// ================================================================
export async function sendChatMessage(
  meetingId: string,
  senderId: number,
  content: string
): Promise<MeetingChatMessage> {
  const meeting = await getMeetingOrThrow(meetingId);

  const sender = meeting.participants.get(senderId);
  if (!sender) throw new Error(MEETING_MESSAGES.NOT_PARTICIPANT);

  if (!content?.trim()) throw new Error(MEETING_MESSAGES.EMPTY_MESSAGE);

  const message: MeetingChatMessage = {
    id: uuidv4(),
    meetingId,
    senderId,
    senderName: sender.fullName,
    content: content.trim(),
    sentAt: new Date(),
  };

  meeting.chatMessages.push(message);
  return message;
}

// ================================================================
// updateParticipantSocket
// Called on socket reconnect to keep socketId fresh.
// ================================================================
export function updateParticipantSocket(
  meetingId: string,
  userId: number,
  newSocketId: string
): void {
  const meeting = meetings.get(meetingId);
  if (!meeting) return;
  const participant = meeting.participants.get(userId);
  if (participant) participant.socketId = newSocketId;
}

// ================================================================
// getParticipantList — safe (no socketId exposed)
// ================================================================
export async function getParticipantList(
  meetingId: string
): Promise<Omit<Participant, "socketId">[]> {
  const meeting = await getMeetingOrThrow(meetingId);
  return Array.from(meeting.participants.values()).map(
    ({ socketId: _s, ...rest }) => rest
  );
}

// ================================================================
// toMeetingResponse — safe HTTP response shape
// ================================================================
export function toMeetingResponse(meeting: MeetingState): MeetingResponse {
  return {
    meetingId: meeting.meetingId,
    meetingLink: meeting.meetingLink,
    hostUserId: meeting.hostUserId,
    sourceType: meeting.sourceType,
    sourceId: meeting.sourceId,
    startedAt: meeting.startedAt,
    isActive: meeting.isActive,
    participantCount: meeting.participants.size,
  };
}