import { Request, Response } from "express";
import { PaymentProvider } from "@prisma/client";
import { persistIdempotencyResponse } from "../middlewares";
import { logger } from "../config/logger";
import { cartService } from "../services/Cart/cart.service";
import {
  deleteCartItemsSchema,
  guestCheckoutDetailsSchema,
  patchCartItemsSchema,
  checkoutOriginSchema
} from "../services/Cart/cart.zod";
import { clearGuestCartCookie, getGuestCartTokenFromRequest, setGuestCartCookie } from "../utils/guest-cart.utils";

class CartController {
  private applyGuestCartCookie(res: Response, payload: { guestCartToken?: string; clearGuestCart?: boolean }) {
    if (payload.clearGuestCart) {
      clearGuestCartCookie(res);
      return;
    }
    if (payload.guestCartToken) {
      setGuestCartCookie(res, payload.guestCartToken);
    }
  }

  async getCart(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      const guestCartToken = getGuestCartTokenFromRequest(req);
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const result = await cartService.getCart({ userId, tenantId, guestCartToken });
      this.applyGuestCartCookie(res, result);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error en getCart controller: ${err.message}`);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async deleteItems(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      const guestCartToken = getGuestCartTokenFromRequest(req);
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = deleteCartItemsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await cartService.deleteItems({ userId, tenantId, guestCartToken }, parsed.data);
      this.applyGuestCartCookie(res, result);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error en deleteItems controller: ${err.message}`);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async patchItems(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      const guestCartToken = getGuestCartTokenFromRequest(req);
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = patchCartItemsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await cartService.patchItems({ userId, tenantId, guestCartToken }, parsed.data);
      this.applyGuestCartCookie(res, result);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error en patchItems controller: ${err.message}`);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async checkout(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const tenantId = req.tenantId;
      const guestCartToken = getGuestCartTokenFromRequest(req);
      const paymentProviderRaw = req.body.paymentProvider;
      const origin = req.body.origin;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const originParsed = checkoutOriginSchema.safeParse(origin);
      if (!originParsed.success) {
        return res.status(400).json({ message: "Origen de checkout inválido. Use 'cart' o 'sale'." });
      }

      if (originParsed.data === "sale" && !userId) {
        return res.status(401).json({ message: "Usuario autenticado requerido para venta POS." });
      }

      if (originParsed.data === "sale" && req.user?.role !== 1) {
        return res.status(403).json({ message: "Solo un administrador puede registrar ventas POS." });
      }

      if (originParsed.data === "sale" && (!paymentProviderRaw || !Object.values(PaymentProvider).includes(paymentProviderRaw))) {
        return res.status(400).json({ message: "Proveedor de pago requerido para venta POS." });
      }

      const guestCheckoutParsed = guestCheckoutDetailsSchema.safeParse({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        createAccountAfterPurchase: req.body.createAccountAfterPurchase
      });
      if (!guestCheckoutParsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: guestCheckoutParsed.error.flatten().fieldErrors
        });
      }

      const paymentProvider: PaymentProvider =
        paymentProviderRaw && Object.values(PaymentProvider).includes(paymentProviderRaw)
          ? paymentProviderRaw
          : PaymentProvider.BANK_TRANSFER;

      const result = await cartService.checkout({
        userId,
        tenantId,
        guestCartToken,
        file: req.file ?? null,
        paymentProvider,
        origin: originParsed.data,
        guestDetails: userId ? undefined : guestCheckoutParsed.data
      });
      this.applyGuestCartCookie(res, result);
      await persistIdempotencyResponse(req, result.status, result);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error en checkout controller: ${err.message}`);
      const responseBody = { message: "Error interno del servidor." };
      await persistIdempotencyResponse(req, 500, responseBody);
      return res.status(500).json(responseBody);
    }
  }

}

export const cartController = new CartController();
