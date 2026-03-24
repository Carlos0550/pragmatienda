import type { Request, Response } from "express";
import { logger } from "../config/logger";
import { getGuestCartTokenFromRequest } from "../utils/guest-cart.utils";
import { shippingService } from "../services/Shipping/shipping.service";
import {
  createShippingMethodSchema,
  shipmentStatusPatchSchema,
  shippingQuoteRequestSchema,
  updateShippingMethodSchema,
} from "../services/Shipping/shipping.zod";

class ShippingController {
  async listMethods(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const result = await shippingService.listMethods(req.tenantId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping listMethods controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async createMethod(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const parsed = createShippingMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await shippingService.createMethod(req.tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping createMethod controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async updateMethod(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const parsed = updateShippingMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await shippingService.updateMethod(req.tenantId, req.params.id, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping updateMethod controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async patchMethodStatus(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const parsed = shipmentStatusPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await shippingService.patchMethodStatus(req.tenantId, req.params.id, parsed.data.isActive);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping patchMethodStatus controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async deleteMethod(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const result = await shippingService.deleteMethod(req.tenantId, req.params.id);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping deleteMethod controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async quoteForCart(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const parsed = shippingQuoteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await shippingService.quoteForCart({
        tenantId: req.tenantId,
        userId: req.user?.id,
        guestCartToken: getGuestCartTokenFromRequest(req),
        quoteType: parsed.data.quoteType,
        shippingAddress: parsed.data.shippingAddress,
      });
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping quoteForCart controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async createShipmentForSale(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const result = await shippingService.createShipmentForSale(req.tenantId, req.params.id);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping createShipmentForSale controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async refreshShipmentForSale(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const result = await shippingService.refreshShipmentForSale(req.tenantId, req.params.id);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping refreshShipmentForSale controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async requoteShipmentForSale(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const result = await shippingService.reQuoteShipmentForSale(req.tenantId, req.params.id);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping requoteShipmentForSale controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async markPickedUp(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId || !req.params.id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }
      const result = await shippingService.markPickedUp(req.tenantId, req.params.id);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping markPickedUp controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const shippingController = new ShippingController();
