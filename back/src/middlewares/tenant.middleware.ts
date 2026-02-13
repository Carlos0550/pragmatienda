import { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { logger } from "../config/logger";

const TENANT_HEADER = "x-tenant-id";

export const getTenantIdFromRequest = (req: Request): string | null => {
  const headerValue = req.header(TENANT_HEADER);
  const tenantId = typeof headerValue === "string" ? headerValue.trim() : "";
  return tenantId.length > 0 ? tenantId : null;
};

export const requireTenant = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = getTenantIdFromRequest(req);
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant requerido." });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant no encontrado." });
    }

    req.tenantId = tenant.id;

    if (req.user?.id) {
      const user = await prisma.user.findFirst({
        where: {
          id: req.user.id,
          tenantId: tenant.id
        },
        select: { id: true }
      });

      if (!user) {
        return res.status(403).json({ error: "Usuario no pertenece al tenant." });
      }
    }

    return next();
  } catch (error) {
    const err = error as Error;
    logger.error("Error al validar tenant: ", err.message);
    return res.status(500).json({ error: "Error al validar tenant." });
  }
};
