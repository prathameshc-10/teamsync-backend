import { Request } from "express";

export interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface CreateOrganizationBody {
  orgName: string;
}

export interface AddMemberBody {
  userId: number;
}

export interface OrgParams {
  orgId: string;
}