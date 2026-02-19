import { PlanType } from "@prisma/client";
import { PrismaBillingRepository } from "../../billing/infrastructure/prisma-billing.repository";
import { MercadoPagoBillingProvider } from "../../billing/infrastructure/mercadopago-billing.provider";
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

    const plan = await billingRepository.createPlan({
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      trialDays: data.trialDays
    });

    if (data.price > 0) {
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
      if (result.preapprovalPlanId) {
        await billingRepository.updatePlanMpPreapprovalId(plan.id, result.preapprovalPlanId);
      }
    }

    return billingRepository.getPlanById(plan.id);
  }

  async updatePlan(id: string, data: UpdatePlanInput) {
    const plan = await billingRepository.getPlanById(id);
    if (!plan) {
      throw new PlansServiceError("Plan no encontrado", "PLAN_NOT_FOUND", 404);
    }

    const updated = await billingRepository.updatePlan(id, {
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      trialDays: data.trialDays,
      active: data.active
    });

    const mpId = updated.mpPreapprovalPlanId;
    const amount = Number(data.price ?? plan.price);

    if (mpId && amount > 0) {
      await billingProvider.updatePreapprovalPlan(mpId, {
        code: plan.code,
        name: data.name ?? plan.name,
        description: data.description ?? plan.description,
        amount,
        currency: data.currency ?? plan.currency,
        interval: data.interval ?? plan.interval,
        trialDays: data.trialDays ?? plan.trialDays,
        mpPreapprovalPlanId: mpId
      });
    } else if (!mpId && amount > 0) {
      const result = await billingProvider.ensurePreapprovalPlan({
        code: plan.code,
        name: data.name ?? plan.name,
        description: data.description ?? plan.description,
        amount,
        currency: data.currency ?? plan.currency,
        interval: data.interval ?? plan.interval,
        trialDays: data.trialDays ?? plan.trialDays
      });
      if (result.preapprovalPlanId) {
        await billingRepository.updatePlanMpPreapprovalId(updated.id, result.preapprovalPlanId);
      }
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

    await billingRepository.updatePlan(id, { active: false });
    return { id, active: false };
  }
}

export const plansService = new PlansService();
