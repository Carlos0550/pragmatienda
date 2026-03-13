import type { NextFunction, Request, Response } from "express";
import {
  isSessionActive,
  type SessionUserPayload,
  verifySessionToken
} from "../config/security";
import { SUPERADMIN_ROLE } from "../constants/roles";

export const getBearerToken = (req: Request): string => {
  const header = req.header("authorization") ?? req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
};

export const resolveAuthenticatedUser = async (req: Request): Promise<SessionUserPayload | null> => {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);
  const isActive = await isSessionActive(token);
  if (!isActive) {
    throw new Error("SESSION_INACTIVE");
  }

  return payload;
};

export const requireRole = (allowedRoles: number[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = await resolveAuthenticatedUser(req);
      if (!payload) {
        return res.status(401).json({ message: "Token de autenticacion requerido" });
      }
      if (!allowedRoles.includes(payload.role)) {
        return res.status(403).json({ message: "No tienes permisos para acceder a este recurso" });
      }
      (req as Request & { user?: SessionUserPayload }).user = payload;
      return next();
    } catch (error) {
      if ((error as Error).message === "SESSION_INACTIVE") {
        return res.status(401).json({ message: "Sesion de autenticacion invalida" });
      }
      return res.status(401).json({ message: "Token de autenticacion invalido" });
    }
  };
};

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = await resolveAuthenticatedUser(req);
    if (!payload) {
      return res.status(401).json({ message: "Token de autenticacion requerido" });
    }
    if (payload.role !== SUPERADMIN_ROLE) {
      return res.status(403).json({ message: "Se requiere rol superadmin" });
    }
    (req as Request & { user?: SessionUserPayload }).user = payload;
    return next();
  } catch (error) {
    if ((error as Error).message === "SESSION_INACTIVE") {
      return res.status(401).json({ message: "Sesion de autenticacion invalida" });
    }
    return res.status(401).json({ message: "Token de autenticacion invalido" });
  }
};
