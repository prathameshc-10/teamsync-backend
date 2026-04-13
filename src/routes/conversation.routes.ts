import { Router, Request, Response, NextFunction } from "express";
import * as ConversationController from "../controllers/conversation.controller";
import { verifyAccessToken } from "../middleware/auth.middleware";
import type { AuthRequest } from "../types/auth.types";

const router = Router();

const asHandler =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AuthRequest, res, next);

const auth = asHandler(
  verifyAccessToken as (req: AuthRequest, res: Response, next: NextFunction) => void
);

router.post("/",            auth, asHandler(ConversationController.createConversation));
router.post("/:id/members", auth, asHandler(ConversationController.addMember));
router.get("/",             auth, asHandler(ConversationController.getMyConversations));

export default router;