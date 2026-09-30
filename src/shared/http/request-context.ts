import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      validated?: { body?: unknown; params?: unknown; query?: unknown };
      authUser?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export function requireAuthUser(request: Request): AuthenticatedUser {
  if (!request.authUser) throw new Error("Authenticated user context is missing");
  return request.authUser;
}
