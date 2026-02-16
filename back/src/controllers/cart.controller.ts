import { Request, Response } from "express";
import { logger } from "../config/logger";
import { cartService } from "../services/Cart/cart.service";
import { patchCartItemsSchema, deleteCartItemsSchema } from "../services/Cart/cart.zod";

class CartController {
  async getCart(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      if (!userId || !tenantId) {
        return res.status(400).json({ message: "Usuario y tenant requeridos." });
      }

      const result = await cartService.getCart(userId, tenantId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getCart controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async deleteItems(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      if (!userId || !tenantId) {
        return res.status(400).json({ message: "Usuario y tenant requeridos." });
      }

      const parsed = deleteCartItemsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await cartService.deleteItems(userId, tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en deleteItems controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async patchItems(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      if (!userId || !tenantId) {
        return res.status(400).json({ message: "Usuario y tenant requeridos." });
      }

      const parsed = patchCartItemsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await cartService.patchItems(userId, tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en patchItems controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async checkout(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      if (!userId || !tenantId) {
        return res.status(400).json({ message: "Usuario y tenant requeridos." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Comprobante de pago requerido." });
      }

      const result = await cartService.checkout(userId, tenantId, req.file);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en checkout controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

}

export const cartController = new CartController();
