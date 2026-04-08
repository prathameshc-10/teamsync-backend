import { Response } from "express";
import * as ConversationService from "../services/conversation.service";
import type { AuthRequest } from "../types/auth.types";
import type { CreateConversationBody, AddMemberBody } from "../types/conversation.types";
import { CONVERSATION_MESSAGES } from "../constants/messages";

export async function createConversation(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: CONVERSATION_MESSAGES.UNAUTHORIZED });
      return;
    }
    const body = req.body as CreateConversationBody;
    if (!body.memberUserIds || !Array.isArray(body.memberUserIds)) {
      res.status(400).json({ success: false, message: CONVERSATION_MESSAGES.MEMBERS_REQUIRED });
      return;
    }
    const conversation = await ConversationService.createConversation(req.user.userId, body);
    res.status(201).json({ success: true, data: { conversation } });
  } catch (error) {
    const message = error instanceof Error ? error.message : CONVERSATION_MESSAGES.FAILED_TO_CREATE;
    res.status(400).json({ success: false, message });
  }
}

export async function addMember(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: CONVERSATION_MESSAGES.UNAUTHORIZED });
      return;
    }
    const conversationId = Number(req.params.id);
    const body = req.body as AddMemberBody;
    if (!body.userId) {
      res.status(400).json({ success: false, message: CONVERSATION_MESSAGES.USERID_REQUIRED });
      return;
    }
    const member = await ConversationService.addMember(conversationId, req.user.userId, body);
    res.status(201).json({ success: true, data: { member } });
  } catch (error) {
    const message = error instanceof Error ? error.message : CONVERSATION_MESSAGES.FAILED_TO_ADD;
    res.status(400).json({ success: false, message });
  }
}

export async function getMyConversations(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: CONVERSATION_MESSAGES.UNAUTHORIZED });
      return;
    }
    const conversations = await ConversationService.getMyConversations(req.user.userId);
    res.status(200).json({ success: true, data: { conversations } });
  } catch (error) {
    const message = error instanceof Error ? error.message : CONVERSATION_MESSAGES.FAILED_TO_FETCH;
    res.status(500).json({ success: false, message });
  }
}