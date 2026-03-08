import { PlanType } from "@prisma/client";
import { PrismaBillingRepository } from "../../billing/infrastructure/prisma-billing.repository";
import { MercadoPagoBillingProvider } from "../../billing/infrastructure/mercadopago-billing.provider";
import { BillingError } from "../../billing/domain/billing-errors";
import type { CreatePlanInput, UpdatePlanInput } from "../plans.zod";

export class PlansServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "PlansServiceError";
  }
}

const billingRepository = new PrismaBillingRepository();
const billingProvider = new MercadoPagoBillingProvider();

const toPlansServiceError = (error: unknown, fallbackMessage: string, fallbackCode: string) => {
  if (error instanceof PlansServiceError) {
    return error;
  }
  if (error instanceof BillingError) {
    return new PlansServiceError(error.message, error.code, error.status);
  }
  return new PlansServiceError(fallbackMessage, fallbackCode, 502);
};

export class PlansService {
  async listPlans() {
    return billingRepository.getAllPlansForAdmin();
  }

  async getPlanById(id: string) {
    const plan = await billingRepository.getPlanById(id);
    if (!plan) {
      throw new PlansServiceError("Plan no encontrado", "PLAN_NOT_FOUND", 404);
    }
    return plan;
  }

  async createPlan(data: CreatePlanInput) {
    const existing = await billingRepository.getPlanByCode(data.code);
    if (existing) {
      throw new PlansServiceError(
        `Ya existe un plan con código ${data.code}`,
        "PLAN_CODE_EXISTS",
        409
      );
    }

    if (data.code !== PlanType.FREE && data.price <= 0) {
      throw new PlansServiceError(
        "Los planes pagos deben tener un precio mayor a 0 para sincronizarse con Mercado Pago.",
        "INVALID_PAID_PLAN_PRICE",
        400
      );
    }

    const plan = await billingRepository.createPlan({
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      trialDays: data.trialDays,
      maxProducts: data.maxProducts ?? null,
      maxCategories: data.maxCategories ?? null,
      features: data.features ?? undefined
    });

    try {
      if (plan.code !== PlanType.FREE) {
        const result = await billingProvider.ensurePreapprovalPlan({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          amount: Number(plan.price),
          currency: plan.currency,
          interval: plan.interval,
          trialDays: plan.trialDays,
          mpPreapprovalPlanId: plan.mpPreapprovalPlanId
        });
        if (!result.preapprovalPlanId) {
          throw new PlansServiceError(
            "No se pudo crear el plan en Mercado Pago.",
            "MP_PLAN_CREATION_FAILED",
            502
          );
        }
        await billingRepository.updatePlanMpPreapprovalId(plan.id, result.preapprovalPlanId);
      }
    } catch (error) {
      await billingRepository.deletePlanById(plan.id).catch(() => undefined);
      throw toPlansServiceError(
        error,
        "No se pudo crear el plan en Mercado Pago.",
        "MP_PLAN_CREATION_FAILED"
      );
    }

    return billingRepository.getPlanById(plan.id);
  }

  async updatePlan(id: string, data: UpdatePlanInput) {
    const plan = await billingRepository.getPlanById(id);
    if (!plan) {
      throw new PlansServiceError("Plan no encontrado", "PLAN_NOT_FOUND", 404);
    }

    const nextPrice = Number(data.price ?? plan.price);
    const nextActive = data.active ?? plan.active;

    if (plan.code !== PlanType.FREE && nextPrice <= 0) {
      throw new PlansServiceError(
        "Los planes pagos deben mantener un precio mayor a 0 para sincronizarse con Mercado Pago.",
        "INVALID_PAID_PLAN_PRICE",
        400
      );
    }

    const updated = await billingRepository.updatePlan(id, {
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      trialDays: data.trialDays,
      active: data.active,
      maxProducts: data.maxProducts,
      maxCategories: data.maxCategories,
      features: data.features
    });

    try {
      if (plan.code === PlanType.FREE) {
        if (updated.mpPreapprovalPlanId) {
          await billingProvider.setPreapprovalPlanStatus(updated.mpPreapprovalPlanId, false);
          await billingRepository.updatePlanMpPreapprovalId(updated.id, null);
        }
        return billingRepository.getPlanById(updated.id);
      }

      let mpId = updated.mpPreapprovalPlanId;

      if (!mpId) {
        const result = await billingProvider.ensurePreapprovalPlan({
          code: plan.code,
          name: data.name ?? plan.name,
          description: data.description ?? plan.description,
          amount: nextPrice,
          currency: data.currency ?? plan.currency,
          interval: data.interval ?? plan.interval,
          trialDays: data.trialDays ?? plan.trialDays
        });
        if (!result.preapprovalPlanId) {
          throw new PlansServiceError(
            "No se pudo crear el plan en Mercado Pago.",
            "MP_PLAN_CREATION_FAILED",
            502
          );
        }
        mpId = result.preapprovalPlanId;
        await billingRepository.updatePlanMpPreapprovalId(updated.id, mpId);
      }

      await billingProvider.updatePreapprovalPlan(mpId, {
        code: plan.code,
        name: data.name ?? plan.name,
        description: data.description ?? plan.description,
        amount: nextPrice,
        currency: data.currency ?? plan.currency,
        interval: data.interval ?? plan.interval,
        trialDays: data.trialDays ?? plan.trialDays,
        mpPreapprovalPlanId: mpId
      });
      await billingProvider.setPreapprovalPlanStatus(mpId, nextActive);
    } catch (error) {
      throw toPlansServiceError(
        error,
        "No se pudo actualizar el plan en Mercado Pago.",
        "MP_PLAN_UPDATE_FAILED"
      );
    }

    return billingRepository.getPlanById(updated.id);
  }

  async deletePlan(id: string) {
    const plan = await billingRepository.getPlanById(id);
    if (!plan) {
      throw new PlansServiceError("Plan no encontrado", "PLAN_NOT_FOUND", 404);
    }

    const activeCount = await billingRepository.countActiveSubscriptionsByPlanId(id);
    if (activeCount > 0) {
      throw new PlansServiceError(
        `No se puede desactivar: hay ${activeCount} suscripción(es) activa(s) con este plan`,
        "PLAN_HAS_ACTIVE_SUBSCRIPTIONS",
        400
      );
    }

    if (plan.mpPreapprovalPlanId) {
      try {
        await billingProvider.setPreapprovalPlanStatus(plan.mpPreapprovalPlanId, false);
      } catch (error) {
        throw toPlansServiceError(
          error,
          "No se pudo desactivar el plan en Mercado Pago.",
          "MP_PLAN_DELETE_FAILED"
        );
      }
    }

    await billingRepository.updatePlan(id, { active: false });
    return { id, active: false };
  }
}

export const plansService = new PlansService();
