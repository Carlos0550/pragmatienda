import { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { logger } from "../config/logger";
import { resolveAuthenticatedUser } from "./auth.middleware";
import { ensureTenantHasActiveSubscription } from "./subscription.middleware";

const TENANT_HEADER = "x-tenant-id";

export const getTenantIdFromRequest = (req: Request): string | null => {
  const headerValue = req.header(TENANT_HEADER);
  const tenantId = typeof headerValue === "string" ? headerValue.trim() : "";
  return tenantId.length > 0 ? tenantId : null;
};

export const requireTenant = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) {
    return res.status(400).json({ message: "Tenant requerido." });
  }

  try {
    if (!req.user) {
      try {
        const payload = await resolveAuthenticatedUser(req);
        if (payload) {
          req.user = payload;
        }
      } catch (error) {
        if ((error as Error).message === "SESSION_INACTIVE") {
          return res.status(401).json({ message: "Sesion de autenticacion invalida" });
        }
        return res.status(401).json({ message: "Token de autenticacion invalido" });
      }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, billingStatus: true, planEndsAt: true }
    });

    if (!tenant) {
      return res.status(404).json({ message: "Tenant no encontrado." });
    }

    req.tenantId = tenant.id;

    if (req.user?.id) {
      const enforcement = ensureTenantHasActiveSubscription(req, res, {
        billingStatus: tenant.billingStatus,
        planEndsAt: tenant.planEndsAt
      });
      if (enforcement !== true) {
        return enforcement;
      }
    }

    if (req.user?.id) {
      const user = await prisma.user.findFirst({
        where: {
          id: req.user.id,
          tenantId: tenant.id
        },
        select: { id: true }
      });

      if (!user) {
        return res.status(403).json({ message: "Usuario no pertenece al tenant." });
      }
    }

    return next();
  } catch (error) {
    const err = error as Error;
    logger.error("Error al validar tenant: ", err.message);
    return res.status(500).json({ message: "Error al validar tenant." });
  }
};
