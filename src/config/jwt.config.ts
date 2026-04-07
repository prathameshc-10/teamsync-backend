// src/config/jwt.config.ts

import { JWT_MESSAGES } from "../constants/messages";
import type { SignOptions } from "jsonwebtoken";

export const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || JWT_MESSAGES.ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY: (process.env.ACCESS_TOKEN_EXPIRY || "15m") as SignOptions["expiresIn"],
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || JWT_MESSAGES.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY: (process.env.REFRESH_TOKEN_EXPIRY || "7d") as SignOptions["expiresIn"],
};

export const BCRYPT_SALT_ROUNDS = 12;   