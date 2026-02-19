import type { NextFunction, Request, Response } from "express";
import {
  isSessionActive,
  type SessionUserPayload,
  verifySessionToken
} from "../config/security";
import { SUPERADMIN_ROLE } from "../constants/roles";

const getBearerToken = (req: Request): string => {
  const header = req.header("authorization") ?? req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
};

export const requireRole = (allowedRoles: number[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Token de autenticacion requerido" });
    }

    try {
      const payload = verifySessionToken(token);
      const isActive = await isSessionActive(token);
      if (!isActive) {
        return res.status(401).json({ error: "Sesion de autenticacion invalida" });
      }
      if (!allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "No tienes permisos para acceder a este recurso" });
      }
      (req as Request & { user?: SessionUserPayload }).user = payload;
      return next();
    } catch {
      return res.status(401).json({ error: "Token de autenticacion invalido" });
    }
  };
};

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Token de autenticacion requerido" });
  }

  try {
    const payload = verifySessionToken(token);
    const isActive = await isSessionActive(token);
    if (!isActive) {
      return res.status(401).json({ error: "Sesion de autenticacion invalida" });
    }
    if (payload.role !== SUPERADMIN_ROLE) {
      return res.status(403).json({ error: "Se requiere rol superadmin" });
    }
    (req as Request & { user?: SessionUserPayload }).user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Token de autenticacion invalido" });
  }
};
