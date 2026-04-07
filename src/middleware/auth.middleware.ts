
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/jwt.config";
import type { AuthRequest, JwtPayload } from "../types/auth.types";
import { AUTH_MESSAGES } from "../constants/messages";

// ================================================================
// verifyAccessToken
// Extracts and validates the Bearer token from Authorization header.
// Attaches decoded payload to req.user for downstream handlers.
// ================================================================
export function verifyAccessToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: AUTH_MESSAGES.NO_TOKEN });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      JWT_CONFIG.ACCESS_TOKEN_SECRET
    ) as unknown as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: AUTH_MESSAGES.TOKEN_EXPIRED });
    } else {
      res.status(401).json({ success: false, message: AUTH_MESSAGES.TOKEN_INVALID });
    }
  }
}