import type { Request, Response } from "express";
import { logger } from "../config/logger";
import { persistIdempotencyResponse } from "../middlewares";
import { billingService } from "../billing/application/billing.service";
import { BillingError } from "../billing/domain/billing-errors";
import { PaymentError } from "../payments/domain/payment-errors";
import { paymentsService } from "../payments/application/payments.service";
import { verifyMercadoPagoWebhookSignature } from "../payments/infrastructure/mercadopago-webhook.security";

class PaymentsController {
  async getMercadoPagoStatus(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const result = await paymentsService.getMercadoPagoStatus(tenantId);
      return res.status(200).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getMercadoPagoStatus controller", { message: err?.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async connectMercadoPago(req: Request, res: Response): Promise<Response> {
    try {
      const storeId = req.params.storeId;
      const actorUserId = req.user?.id;
      if (!storeId || !actorUserId || !req.tenantId) {
        return res.status(400).json({ message: "Contexto inválido para conectar cuenta." });
      }
      if (req.tenantId !== storeId) {
        return res.status(403).json({ message: "No autorizado para conectar otra tienda." });
      }

      const result = await paymentsService.getMercadoPagoConnectUrl(storeId, actorUserId);
      res.redirect(result.authorizationUrl);
      return res;
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code,
          details: error.details
        });
      }
      const err = error as Error;
      logger.error("Error en connectMercadoPago controller", {
        message: err.message
      });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async getMercadoPagoConnectUrl(req: Request, res: Response): Promise<Response> {
    try {
      const storeId = req.tenantId;
      const actorUserId = req.user?.id;
      if (!storeId || !actorUserId) {
        return res.status(400).json({ message: "Contexto inválido para conectar cuenta." });
      }

      const result = await paymentsService.getMercadoPagoConnectUrl(storeId, actorUserId);
      return res.status(200).json({ authorizationUrl: result.authorizationUrl });
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code,
          details: error.details
        });
      }
      const err = error as Error;
      logger.error("Error en getMercadoPagoConnectUrl controller", {
        message: err.message
      });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async callbackMercadoPago(req: Request, res: Response): Promise<Response> {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state) {
        return res.status(400).send("OAuth callback inválido.");
      }

      await paymentsService.completeMercadoPagoConnection(code, state);
      res.redirect(paymentsService.getOAuthCallbackRedirectUrl(true));
      return res;
    } catch (error) {
      if (error instanceof PaymentError) {
        logger.warn("OAuth MercadoPago failed", {
          code: error.code,
          message: error.message
        });
        res.redirect(paymentsService.getOAuthCallbackRedirectUrl(false));
        return res;
      }
      const err = error as Error;
      logger.error("Error en callbackMercadoPago controller", {
        message: err.message
      });
      res.redirect(paymentsService.getOAuthCallbackRedirectUrl(false));
      return res;
    }
  }

  async createMercadoPagoCheckout(req: Request, res: Response): Promise<Response> {
    try {
      const storeId = req.tenantId;
      const orderId = req.params.orderId;
      if (!storeId || !orderId) {
        return res.status(400).json({ message: "store y orderId requeridos." });
      }

      const idempotencyKeyRaw = req.header("idempotency-key") ?? "";
      const idempotencyKey = idempotencyKeyRaw.trim();
      if (!idempotencyKey) {
        return res.status(400).json({ message: "Header Idempotency-Key requerido." });
      }

      const result = await paymentsService.createMercadoPagoCheckout(
        storeId,
        orderId,
        idempotencyKey
      );
      const responseBody = {
        message: "Checkout Mercado Pago generado correctamente.",
        data: result
      };
      await persistIdempotencyResponse(req, 200, responseBody);
      return res.status(200).json(responseBody);
    } catch (error) {
      if (error instanceof PaymentError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code,
          details: error.details
        });
      }
      const err = error as Error;
      logger.error("Error en createMercadoPagoCheckout controller", {
        message: err.message
      });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async webhookMercadoPago(req: Request, res: Response): Promise<Response> {
    try {
      if (!verifyMercadoPagoWebhookSignature(req)) {
        return res.status(401).json({ message: "Firma de webhook inválida." });
      }

      const payload = {
        ...(req.query as Record<string, unknown>),
        ...((req.body ?? {}) as Record<string, unknown>)
      };
      const typeRaw =
        typeof payload.type === "string"
          ? payload.type
          : typeof payload.topic === "string"
            ? payload.topic
            : "";

      const typeLower = typeRaw.toLowerCase();
      if (typeLower.includes("preapproval")) {
        const result = await billingService.handlePreapprovalWebhook(payload);
        return res.status(200).json({
          message: "Webhook billing procesado.",
          data: result
        });
      }
      if (typeLower === "subscription_authorized_payment") {
        return res.status(200).json({ message: "Webhook billing ignorado (authorized_payment)." });
      }

      const result = await paymentsService.handleMercadoPagoWebhook(payload);

      return res.status(200).json({
        message: "Webhook procesado.",
        data: result
      });
    } catch (error) {
      if (error instanceof BillingError) {
        if (error.code === "INVALID_WEBHOOK") {
          logger.warn("Webhook billing ignorado (INVALID_WEBHOOK)", {
            message: error.message,
            query: req.query,
            body: req.body
          });
          return res.status(200).json({ message: "Webhook billing ignorado." });
        }
        logger.error("BillingError en webhookMercadoPago", {
          code: error.code,
          message: error.message
        });
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      if (error instanceof PaymentError) {
        if (error.code === "INVALID_WEBHOOK") {
          return res.status(200).json({ message: "Webhook ignorado." });
        }
        if (error.code === "ACCOUNT_NOT_CONNECTED") {
          return res.status(200).json({ message: "Webhook de pago ignorado (billing/suscripción)." });
        }
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en webhookMercadoPago controller", {
        message: err.message
      });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const paymentsController = new PaymentsController();
