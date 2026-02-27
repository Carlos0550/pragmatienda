import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../config/logger";
import { BillingError } from "../billing/domain/billing-errors";
import { billingService } from "../billing/application/billing.service";

const planIdSchema = z.object({
  planId: z.string().cuid()
}).strict();

class BillingController {
  async createSubscription(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = planIdSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await billingService.createSubscriptionByPlanId(tenantId, parsed.data.planId);
      return res.status(201).json({
        message: "Suscripción creada.",
        data: result
      });
    } catch (error) {
      if (error instanceof BillingError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code,
          details: error.details
        });
      }
      const err = error as Error;
      logger.error("Error en createSubscription controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async changeSubscriptionPlan(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const parsed = planIdSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }
      const result = await billingService.changeSubscriptionPlanByPlanId(tenantId, parsed.data.planId);
      return res.status(200).json({
        message: "Plan de suscripción actualizado.",
        data: result
      });
    } catch (error) {
      if (error instanceof BillingError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en changeSubscriptionPlan controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async listPublicPlans(_req: Request, res: Response): Promise<Response> {
    try {
      const plans = await billingService.listPublicPlans();
      return res.status(200).json(plans);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en listPublicPlans controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async getCurrentSubscription(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const subscription = await billingService.getCurrentSubscription(tenantId);
      return res.status(200).json(subscription);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getCurrentSubscription controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async listPlansForBilling(req: Request, res: Response): Promise<Response> {
    try {
      const plans = await billingService.listPlansForBilling();
      return res.status(200).json(plans);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en listPlansForBilling controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async syncSubscriptions(req: Request, res: Response): Promise<Response> {
    try {
      const result = await billingService.syncActiveSubscriptionsJob();
      return res.status(200).json({
        message: "Sincronización ejecutada.",
        data: result
      });
    } catch (error) {
      if (error instanceof BillingError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en syncSubscriptions controller", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const billingController = new BillingController();
