import { Request, Response } from "express";
import { logger } from "../config/logger";
import { salesService } from "../services/Sales/sales.service";
import {
  listSalesQuerySchema,
  updateSaleSchema,
  patchSaleItemsSchema
} from "../services/Sales/sales.zod";

class SalesController {
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = listSalesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await salesService.list(tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales list controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async getOne(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const saleId = req.params.id;
      if (!tenantId || !saleId) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }

      const result = await salesService.getOne(tenantId, saleId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales getOne controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async getMetrics(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const from = req.query.from as string;
      const to = req.query.to as string;
      const groupBy = (req.query.groupBy as "day" | "week" | "month") ?? "day";

      if (!tenantId || !from || !to) {
        return res.status(400).json({ message: "Tenant, from y to requeridos." });
      }

      const result = await salesService.getMetrics(tenantId, from, to, groupBy);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales getMetrics controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const saleId = req.params.id;
      if (!tenantId || !saleId) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }

      const parsed = updateSaleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await salesService.update(tenantId, saleId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales update controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async patchItems(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const saleId = req.params.id;
      if (!tenantId || !saleId) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }

      const parsed = patchSaleItemsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await salesService.patchItems(tenantId, saleId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales patchItems controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const saleId = req.params.id;
      if (!tenantId || !saleId) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }

      const result = await salesService.delete(tenantId, saleId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales delete controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const salesController = new SalesController();
