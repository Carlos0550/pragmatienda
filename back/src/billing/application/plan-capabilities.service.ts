import { BillingStatus, PlanType, type Plan } from "@prisma/client";
import { BillingError } from "../domain/billing-errors";
import type { PlanCapabilities, PlanUsage, TenantCapabilitiesResponse } from "../domain/plan-capabilities.types";
import { PrismaBillingRepository } from "../infrastructure/prisma-billing.repository";

const DEFAULT_FEATURES: Record<string, boolean> = Object.freeze({});

function planToCapabilities(plan: Plan): PlanCapabilities {
  const features =
    plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
      ? (plan.features as Record<string, boolean>)
      : DEFAULT_FEATURES;
  return {
    planCode: plan.code,
    planId: plan.id,
    maxProducts: plan.maxProducts ?? null,
    maxCategories: plan.maxCategories ?? null,
    features: { ...DEFAULT_FEATURES, ...features }
  };
}

export class PlanCapabilitiesService {
  constructor(private readonly repository: PrismaBillingRepository) {}

  private async getFreePlan(): Promise<Plan | null> {
    return this.repository.getPlanByCode(PlanType.FREE);
  }

  /** Obtiene el plan efectivo del tenant (suscripción actual o plan por defecto del tenant). */
  async getEffectivePlanForTenant(tenantId: string): Promise<Plan | null> {
    const subscription = await this.repository.getCurrentSubscriptionForTenant(tenantId);
    if (subscription?.plan) {
      if (
        !subscription.status ||
        subscription.status === BillingStatus.ACTIVE ||
        subscription.status === BillingStatus.TRIALING
      ) {
        return subscription.plan;
      }

      return this.getFreePlan();
    }

    const tenant = await this.repository.getTenantWithOwner(tenantId);
    if (!tenant?.plan) {
      return null;
    }

    if (
      tenant.plan !== PlanType.FREE &&
      tenant.billingStatus !== BillingStatus.ACTIVE &&
      tenant.billingStatus !== BillingStatus.TRIALING
    ) {
      return this.getFreePlan();
    }

    return this.repository.getPlanByCode(tenant.plan);
  }

  /** Devuelve las capacidades del plan del tenant. Si no hay plan, lanza. */
  async getCapabilities(tenantId: string): Promise<PlanCapabilities> {
    const plan = await this.getEffectivePlanForTenant(tenantId);
    if (!plan) {
      throw new BillingError(404, "PLAN_NOT_FOUND", "No se pudo determinar el plan del tenant.");
    }
    return planToCapabilities(plan);
  }

  /** Devuelve el uso actual del tenant (conteos). */
  async getUsage(tenantId: string): Promise<PlanUsage> {
    const [productsCount, categoriesCount] = await Promise.all([
      this.repository.countProductsByTenant(tenantId),
      this.repository.countCategoriesByTenant(tenantId)
    ]);
    return { productsCount, categoriesCount };
  }

  /** Capacidades + uso actual para API. */
  async getTenantCapabilities(tenantId: string): Promise<TenantCapabilitiesResponse | null> {
    const plan = await this.getEffectivePlanForTenant(tenantId);
    if (!plan) {
      return null;
    }
    const usage = await this.getUsage(tenantId);
    return {
      ...planToCapabilities(plan),
      usage
    };
  }

  /** Bloqueo duro: lanza si el tenant ya alcanzó el límite de productos. */
  async assertCanCreateProduct(tenantId: string): Promise<void> {
    const caps = await this.getCapabilities(tenantId);
    if (caps.maxProducts == null) {
      return;
    }
    const usage = await this.getUsage(tenantId);
    if (usage.productsCount >= caps.maxProducts) {
      throw new BillingError(
        402,
        "PLAN_LIMIT_REACHED",
        `Has alcanzado el límite de productos de tu plan (${caps.maxProducts}). Actualiza tu plan para agregar más.`,
        { limit: caps.maxProducts, current: usage.productsCount, resource: "products" }
      );
    }
  }

  /** Bloqueo duro: lanza si el tenant ya alcanzó el límite de categorías. */
  async assertCanCreateCategory(tenantId: string): Promise<void> {
    const caps = await this.getCapabilities(tenantId);
    if (caps.maxCategories == null) {
      return;
    }
    const usage = await this.getUsage(tenantId);
    if (usage.categoriesCount >= caps.maxCategories) {
      throw new BillingError(
        402,
        "PLAN_LIMIT_REACHED",
        `Has alcanzado el límite de categorías de tu plan (${caps.maxCategories}). Actualiza tu plan para agregar más.`,
        { limit: caps.maxCategories, current: usage.categoriesCount, resource: "categories" }
      );
    }
  }

  /** Bloqueo duro: lanza si la feature no está habilitada en el plan. */
  async assertFeature(tenantId: string, featureName: string): Promise<void> {
    const caps = await this.getCapabilities(tenantId);
    if (caps.features[featureName] === true) {
      return;
    }
    throw new BillingError(
      402,
      "FEATURE_NOT_AVAILABLE",
      `La función "${featureName}" no está incluida en tu plan actual. Actualiza tu plan para acceder.`,
      { feature: featureName }
    );
  }
}

const repo = new PrismaBillingRepository();
export const planCapabilitiesService = new PlanCapabilitiesService(repo);
