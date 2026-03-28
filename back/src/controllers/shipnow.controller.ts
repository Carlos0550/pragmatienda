import type { Request, Response } from "express";
import { logger } from "../config/logger";
import { prisma } from "../db/prisma";

class ShipnowController {
  async getConfig(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const config = await prisma.shipnowConfig.findUnique({
        where: { tenantId: req.tenantId },
      });

      return res.status(200).json({
        status: 200,
        message: "Configuración de ShipNow obtenida.",
        data: {
          acceptedTerms: config?.acceptedTerms ?? false,
          acceptedAt: config?.acceptedAt,
        },
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Error al obtener config de ShipNow", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async acceptTerms(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const config = await prisma.shipnowConfig.upsert({
        where: { tenantId: req.tenantId },
        update: {
          acceptedTerms: true,
          acceptedAt: new Date(),
        },
        create: {
          tenantId: req.tenantId,
          acceptedTerms: true,
          acceptedAt: new Date(),
        },
      });

      return res.status(200).json({
        status: 200,
        message: "Términos de ShipNow aceptados correctamente.",
        data: {
          acceptedTerms: config.acceptedTerms,
          acceptedAt: config.acceptedAt,
        },
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Error al aceptar términos de ShipNow", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const shipnowController = new ShipnowController();
