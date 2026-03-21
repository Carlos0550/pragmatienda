import { BillingStatus, PlanType, Prisma, type Plan } from "@prisma/client";
import { logger } from "../../config/logger";
import { BillingError } from "../domain/billing-errors";
import { mapMercadoPagoPreapprovalStatus } from "../domain/billing-status.mapper";
import type { BillingProvider } from "../domain/billing-provider";
import { MercadoPagoBillingProvider } from "../infrastructure/mercadopago-billing.provider";
import { PrismaBillingRepository } from "../infrastructure/prisma-billing.repository";
import { getStoreUrl } from "../../utils/storefront.utils";

const BILLING_WEBHOOK_PROVIDER = "MERCADOPAGO_BILLING";

const toJsonValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

const webhookEventId = (subscriptionId: string, webhookId: string) =>
  `preapproval:${subscriptionId}:${webhookId || "unknown"}`;

const REUSABLE_SUBSCRIPTION_STATUSES = new Set<BillingStatus>([
  BillingStatus.ACTIVE,
  BillingStatus.TRIALING,
  BillingStatus.PAST_DUE
]);

const EFFECTIVE_SUBSCRIPTION_STATUSES = new Set<BillingStatus>([
  BillingStatus.ACTIVE,
  BillingStatus.TRIALING,
  BillingStatus.PAST_DUE
]);

export class BillingService {
  constructor(
    private readonly repository: PrismaBillingRepository,
    private readonly provider: BillingProvider
  ) {}

  async createSubscriptionByPlanId(tenantId: string, planId: string) {
    const plan = await this.repository.getPlanById(planId);
    if (!plan) {
      throw new BillingError(404, "PLAN_NOT_FOUND", "Plan no encontrado.");
    }
    return this.createSubscriptionForTenant(tenantId, plan.code);
  }

  async createSubscriptionForTenant(tenantId: string, planCode: PlanType) {
    const tenant = await this.repository.getTenantWithOwner(tenantId);
    if (!tenant) {
      throw new BillingError(404, "TENANT_NOT_FOUND", "Tenant no encontrado.");
    }
    if (!tenant.owner?.email) {
      throw new BillingError(400, "TENANT_NOT_FOUND", "Owner del tenant sin email.");
    }

    const plan = await this.repository.getPlanByCode(planCode);
    if (!plan) {
      throw new BillingError(404, "PLAN_NOT_FOUND", "Plan no encontrado.");
    }
    if (!plan.active) {
      throw new BillingError(400, "PLAN_INACTIVE", "El plan seleccionado no está activo.");
    }
    if (plan.code === PlanType.FREE) {
      throw new BillingError(400, "PLAN_UNAVAILABLE", "El plan FREE no requiere suscripción de cobro.");
    }

    const currentSubscription = await this.resolveCurrentSubscriptionForTenant(tenantId);
    const canReuseCurrentSubscription =
      currentSubscription &&
      currentSubscription.plan.code !== PlanType.FREE &&
      currentSubscription.plan.code === plan.code &&
      REUSABLE_SUBSCRIPTION_STATUSES.has(currentSubscription.status);

    if (canReuseCurrentSubscription) {
      logger.info("Billing: se reutiliza suscripción existente", {
        tenantId,
        subscriptionId: currentSubscription.id,
        status: currentSubscription.status
      });
      return {
        created: false,
        subscriptionId: currentSubscription.id,
        externalSubscriptionId: currentSubscription.externalSubscriptionId,
        initPoint: null
      };
    }

    const storeSuccessUrl = tenant.businessData?.website
      ? getStoreUrl(tenant.businessData.website, "/admin/billing")
      : null;

    const billing = await this.provider.createSubscription({
      tenantId: tenant.id,
      ownerEmail: tenant.owner.email,
      planCode: plan.code,
      planName: plan.name,
      amount: Number(plan.price),
      currency: plan.currency,
      interval: plan.interval,
      trialDays: plan.trialDays,
      preapprovalPlanId: plan.mpPreapprovalPlanId,
      storeSuccessUrl
    });

    if (!billing.externalSubscriptionId) {
      logger.warn("Billing: provider no devolvió externalSubscriptionId", {
        tenantId: tenant.id,
        planId: plan.id,
        hasInitPoint: !!billing.initPoint
      });
      if (billing.initPoint) {
        return {
          created: true,
          subscriptionId: null,
          externalSubscriptionId: null,
          initPoint: billing.initPoint
        };
      }
      throw new BillingError(502, "PROVIDER_ERROR", "El proveedor no devolvió un ID de suscripción.");
    }

    const subscription = await this.repository.createSubscription({
      tenantId: tenant.id,
      planId: plan.id,
      externalSubscriptionId: billing.externalSubscriptionId,
      status: mapMercadoPagoPreapprovalStatus(billing.status),
      currentPeriodStart: billing.currentPeriodStart ?? null,
      currentPeriodEnd: billing.currentPeriodEnd ?? null
    });

    await this.repository.createSubscriptionEvent(
      subscription.id,
      "subscription.created",
      toJsonValue({
        providerStatus: billing.status,
        initPoint: billing.initPoint
      })
    );

    await this.syncTenantWithSubscription(subscription.externalSubscriptionId);

    return {
      created: true,
      subscriptionId: subscription.id,
      externalSubscriptionId: billing.externalSubscriptionId,
      initPoint: billing.initPoint
    };
  }

  async handlePreapprovalWebhook(payload: Record<string, unknown>) {
    const dataIdRaw =
      typeof payload.data === "object" && payload.data !== null && "id" in payload.data
        ? (payload.data as { id?: unknown }).id
        : payload["data.id"] ?? payload["id"];
    const externalSubscriptionId =
      typeof dataIdRaw === "string" || typeof dataIdRaw === "number"
        ? String(dataIdRaw)
        : "";
    if (!externalSubscriptionId) {
      throw new BillingError(400, "INVALID_WEBHOOK", "Webhook preapproval sin id.");
    }

    const webhookId =
      typeof payload.id === "string" || typeof payload.id === "number"
        ? String(payload.id)
        : `mp-billing-${Date.now()}`;

    const snapshot = await this.provider.getSubscription(externalSubscriptionId);
    logger.info("Billing webhook: snapshot de MP", {
      externalSubscriptionId,
      externalReference: snapshot.externalReference,
      payerEmail: snapshot.payerEmail,
      status: snapshot.status,
      preapprovalPlanId: snapshot.preapprovalPlanId
    });

    let tenantId = snapshot.externalReference;

    if (!tenantId) {
      const existingSub = await this.repository.getSubscriptionByExternalId(externalSubscriptionId);
      if (existingSub) {
        tenantId = existingSub.tenantId;
        logger.info("Billing webhook: tenant encontrado por subscription existente", { tenantId });
      }
    }

    if (!tenantId && snapshot.payerEmail) {
      const tenantByEmail = await this.repository.getTenantByOwnerEmail(snapshot.payerEmail);
      if (tenantByEmail) {
        tenantId = tenantByEmail.id;
        logger.info("Billing webhook: tenant encontrado por email", { tenantId, email: snapshot.payerEmail });
      }
    }

    if (!tenantId) {
      logger.warn("Billing webhook: no se pudo encontrar tenant", {
        externalSubscriptionId,
        externalReference: snapshot.externalReference,
        payerEmail: snapshot.payerEmail
      });
      throw new BillingError(
        400,
        "INVALID_WEBHOOK",
        "Suscripción sin external_reference ni payer_email coincidente con tenant."
      );
    }

    const tenant = await this.repository.getTenantWithOwner(tenantId);
    if (!tenant) {
      throw new BillingError(404, "TENANT_NOT_FOUND", "Tenant no encontrado para webhook.");
    }

    let plan = await this.resolveCurrentSubscriptionForTenant(tenantId);
    if (!plan) {
      let fallbackPlan =
        snapshot.preapprovalPlanId
          ? await this.repository.getPlanByMpPreapprovalPlanId(snapshot.preapprovalPlanId)
          : null;
      if (!fallbackPlan) {
        fallbackPlan = await this.repository.getPlanByCode(tenant.plan);
      }
      if (!fallbackPlan) {
        throw new BillingError(404, "PLAN_NOT_FOUND", "Plan de tenant no encontrado.");
      }
      plan = {
        id: "",
        tenantId,
        planId: fallbackPlan.id,
        externalSubscriptionId,
        status: BillingStatus.INACTIVE,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: fallbackPlan
      };
    }

    const mappedStatus = mapMercadoPagoPreapprovalStatus(snapshot.status);
    const subscription = await this.repository.upsertSubscriptionByExternalId({
      tenantId,
      planId: plan.planId,
      externalSubscriptionId: snapshot.externalSubscriptionId,
      status: mappedStatus,
      currentPeriodStart: snapshot.currentPeriodStart ?? null,
      currentPeriodEnd: snapshot.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd
    });

    const eventId = webhookEventId(snapshot.externalSubscriptionId, webhookId);
    await this.repository.upsertWebhookEvent(
      tenantId,
      BILLING_WEBHOOK_PROVIDER,
      eventId,
      "preapproval",
      toJsonValue(snapshot.raw)
    );

    await this.repository.createSubscriptionEvent(
      subscription.id,
      "preapproval.webhook",
      toJsonValue(snapshot.raw)
    );

    await this.syncTenantWithSubscription(subscription.externalSubscriptionId);

    logger.info("Billing preapproval webhook processed", {
      store_id: tenantId,
      subscription_id: snapshot.externalSubscriptionId
    });

    return {
      tenantId,
      subscriptionId: subscription.id,
      externalSubscriptionId: snapshot.externalSubscriptionId
    };
  }

  async syncTenantWithSubscription(externalSubscriptionId: string) {
    const target = await this.repository.getSubscriptionByExternalId(externalSubscriptionId);
    if (!target) {
      throw new BillingError(404, "SUBSCRIPTION_NOT_FOUND", "Suscripción no encontrada para sincronización.");
    }

    const shouldPromoteTarget =
      EFFECTIVE_SUBSCRIPTION_STATUSES.has(target.status) ||
      target.tenant.currentSubscriptionId === target.id;

    if (!shouldPromoteTarget) {
      logger.info("Billing: se mantiene snapshot actual del tenant para suscripción no efectiva", {
        tenantId: target.tenantId,
        subscriptionId: target.id,
        status: target.status
      });
      return;
    }

    const status = target.status;
    const planCode = target.plan.code;
    const planStartsAt = target.currentPeriodStart ?? target.createdAt;
    const planEndsAt = target.currentPeriodEnd ?? target.updatedAt;

    await this.repository.setTenantBillingSnapshot({
      tenantId: target.tenantId,
      billingStatus: status,
      planCode,
      planStartsAt,
      planEndsAt,
      currentSubscriptionId: target.id
    });
  }

  private async resolveCurrentSubscriptionForTenant(tenantId: string) {
    const currentSubscription = await this.repository.getTenantCurrentSubscription(tenantId);
    if (currentSubscription) {
      return currentSubscription;
    }

    const legacySubscription = await this.repository.getLatestSubscriptionForTenant(tenantId);
    if (!legacySubscription) {
      return null;
    }

    if (!EFFECTIVE_SUBSCRIPTION_STATUSES.has(legacySubscription.status)) {
      return null;
    }

    await this.repository.setTenantBillingSnapshot({
      tenantId,
      billingStatus: legacySubscription.status,
      planCode: legacySubscription.plan.code,
      planStartsAt: legacySubscription.currentPeriodStart ?? legacySubscription.createdAt,
      planEndsAt: legacySubscription.currentPeriodEnd ?? legacySubscription.updatedAt,
      currentSubscriptionId: legacySubscription.id
    });

    return legacySubscription;
  }

  async changeSubscriptionPlanByPlanId(tenantId: string, planId: string) {
    const plan = await this.repository.getPlanById(planId);
    if (!plan) {
      throw new BillingError(404, "PLAN_NOT_FOUND", "Plan no encontrado.");
    }
    return this.changeSubscriptionPlan(tenantId, plan.code);
  }

  async changeSubscriptionPlan(tenantId: string, planCode: PlanType) {
    const plan = await this.repository.getPlanByCode(planCode);
    if (!plan) {
      throw new BillingError(404, "PLAN_NOT_FOUND", "Plan no encontrado.");
    }
    if (!plan.active) {
      throw new BillingError(400, "PLAN_INACTIVE", "El plan no está activo.");
    }
    if (plan.code === PlanType.FREE) {
      throw new BillingError(400, "PLAN_UNAVAILABLE", "No se puede cambiar a FREE vía suscripción paga.");
    }

    const current = await this.resolveCurrentSubscriptionForTenant(tenantId);
    if (!current) {
      throw new BillingError(404, "SUBSCRIPTION_NOT_FOUND", "No hay suscripción activa para cambiar plan.");
    }

    if (current.plan.code === PlanType.FREE) {
      const createdSubscription = await this.createSubscriptionForTenant(tenantId, planCode);
      return {
        subscriptionId: createdSubscription.subscriptionId,
        externalSubscriptionId: createdSubscription.externalSubscriptionId,
        initPoint: createdSubscription.initPoint ?? null
      };
    }

    const currentProviderSnapshot = await this.provider.getSubscription(current.externalSubscriptionId);
    if (currentProviderSnapshot.externalReference && currentProviderSnapshot.externalReference !== tenantId) {
      throw new BillingError(
        403,
        "ACCESS_DENIED",
        "La suscripción del proveedor no pertenece al tenant actual."
      );
    }

    const snapshot = await this.provider.changeSubscriptionPlan({
      externalSubscriptionId: current.externalSubscriptionId,
      planCode: plan.code,
      planName: plan.name,
      amount: Number(plan.price),
      currency: plan.currency,
      interval: plan.interval
    });

    if (snapshot.externalReference && snapshot.externalReference !== tenantId) {
      throw new BillingError(
        403,
        "ACCESS_DENIED",
        "La suscripción del proveedor no pertenece al tenant actual."
      );
    }

    const subscription = await this.repository.upsertSubscriptionByExternalId({
      tenantId,
      planId: plan.id,
      externalSubscriptionId: snapshot.externalSubscriptionId,
      status: mapMercadoPagoPreapprovalStatus(snapshot.status),
      currentPeriodStart: snapshot.currentPeriodStart ?? current.currentPeriodStart,
      currentPeriodEnd: snapshot.currentPeriodEnd ?? current.currentPeriodEnd,
      cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd ?? current.cancelAtPeriodEnd
    });

    await this.repository.createSubscriptionEvent(
      subscription.id,
      "subscription.plan_changed",
      toJsonValue({
        newPlanCode: planCode,
        amount: Number(plan.price),
        currency: plan.currency,
        interval: plan.interval,
        providerStatus: snapshot.status
      })
    );

    await this.syncTenantWithSubscription(snapshot.externalSubscriptionId);

    return { subscriptionId: subscription.id, externalSubscriptionId: snapshot.externalSubscriptionId };
  }

  async assignPlanManually(tenantId: string, planCode: PlanType) {
    const tenant = await this.repository.getTenantWithOwner(tenantId);
    if (!tenant) {
      throw new BillingError(404, "TENANT_NOT_FOUND", "Tenant no encontrado.");
    }

    const plan = await this.repository.getPlanByCode(planCode);
    if (!plan) {
      throw new BillingError(404, "PLAN_NOT_FOUND", "Plan no encontrado.");
    }
    if (!plan.active) {
      throw new BillingError(400, "PLAN_INACTIVE", "El plan no está activo.");
    }
    if (plan.code === PlanType.FREE) {
      throw new BillingError(400, "PLAN_UNAVAILABLE", "La asignación manual solo permite planes pagos.");
    }

    const assignedAt = new Date();
    const externalSubscriptionId = `manual-${tenantId}-${plan.code}-${assignedAt.getTime()}`;
    const subscription = await this.repository.createSubscription({
      tenantId,
      planId: plan.id,
      externalSubscriptionId,
      status: BillingStatus.ACTIVE,
      currentPeriodStart: assignedAt,
      currentPeriodEnd: null
    });

    await this.repository.createSubscriptionEvent(
      subscription.id,
      "subscription.assigned_manually",
      toJsonValue({
        source: "script",
        planCode: plan.code,
        assignedAt: assignedAt.toISOString()
      })
    );

    await this.syncTenantWithSubscription(externalSubscriptionId);

    return {
      subscriptionId: subscription.id,
      externalSubscriptionId,
      planId: plan.id,
      planCode: plan.code
    };
  }

  async resumeCurrentSubscription(tenantId: string) {
    const current = await this.resolveCurrentSubscriptionForTenant(tenantId);
    if (!current) {
      throw new BillingError(404, "SUBSCRIPTION_NOT_FOUND", "No hay suscripción para reanudar.");
    }

    if (
      current.status === BillingStatus.ACTIVE ||
      current.status === BillingStatus.TRIALING
    ) {
      throw new BillingError(400, "SUBSCRIPTION_ALREADY_ACTIVE", "La suscripción actual ya está activa.");
    }

    if (current.plan.code === PlanType.FREE) {
      throw new BillingError(400, "PLAN_UNAVAILABLE", "El plan FREE no requiere reanudación.");
    }

    return this.createSubscriptionForTenant(tenantId, current.plan.code);
  }

  async syncActiveSubscriptionsJob() {
    const statuses = ["authorized", "pending", "paused", "cancelled", "expired"] as const;
    let processed = 0;

    for (const status of statuses) {
      const snapshots = await this.provider.searchSubscriptionsByStatus(status);
      for (const snapshot of snapshots) {
        if (!snapshot.externalReference) {
          continue;
        }
        const tenant = await this.repository.getTenantWithOwner(snapshot.externalReference);
        if (!tenant) {
          continue;
        }
        const current = await this.resolveCurrentSubscriptionForTenant(snapshot.externalReference);
        const planCode = current?.plan.code ?? tenant.plan;
        const plan = await this.repository.getPlanByCode(planCode);
        if (!plan) {
          continue;
        }

        const subscription = await this.repository.upsertSubscriptionByExternalId({
          tenantId: tenant.id,
          planId: plan.id,
          externalSubscriptionId: snapshot.externalSubscriptionId,
          status: mapMercadoPagoPreapprovalStatus(snapshot.status),
          currentPeriodStart: snapshot.currentPeriodStart,
          currentPeriodEnd: snapshot.currentPeriodEnd,
          cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd
        });

        await this.repository.createSubscriptionEvent(
          subscription.id,
          "subscription.sync",
          toJsonValue(snapshot.raw)
        );
        await this.syncTenantWithSubscription(subscription.externalSubscriptionId);
        processed += 1;
      }
    }

    return { processed };
  }

  /** Lista planes activos para la landing pública (sin auth ni tenant). */
  async listPublicPlans() {
    const plans = await this.repository.getAllPlans();
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      currency: p.currency,
      interval: p.interval,
      description: p.description ?? undefined,
      trialDays: p.trialDays,
    }));
  }

  /** Suscripción actual del tenant (para admin billing). */
  async getCurrentSubscription(tenantId: string) {
    const sub = await this.resolveCurrentSubscriptionForTenant(tenantId);
    if (!sub) return null;
    return {
      id: sub.id,
      planId: sub.planId,
      plan: this.mapPlanToResponse(sub.plan),
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  /** Lista planes para la UI de billing (admin). */
  async listPlansForBilling() {
    const plans = await this.repository.getAllPlans();
    return plans.map((p) => this.mapPlanToResponse(p));
  }

  private mapPlanToResponse(p: Plan) {
    const features =
      p.features && typeof p.features === "object" && !Array.isArray(p.features)
        ? (p.features as Record<string, boolean>)
        : {};
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      price: Number(p.price),
      currency: p.currency,
      interval: p.interval,
      description: p.description ?? undefined,
      trialDays: p.trialDays,
      features,
      active: p.active,
      maxProducts: p.maxProducts ?? null,
      maxCategories: p.maxCategories ?? null
    };
  }

  async syncPreapprovalPlans() {
    const plans = await this.repository.getAllPlans();
    return this.syncPreapprovalPlansFromList(plans);
  }

  /**
   * Sincroniza todos los planes de la DB (activos e inactivos) con Mercado Pago:
   * crea el preapproval plan en MP si no existe y actualiza mpPreapprovalPlanId en la DB.
   * No crea nuevos planes en la DB.
   */
  async syncAllPreapprovalPlans() {
    const plans = await this.repository.getAllPlansForAdmin();
    return this.syncPreapprovalPlansFromList(plans);
  }

  private async syncPreapprovalPlansFromList(
    plans: Array<{
      id: string;
      code: PlanType;
      name: string;
      description: string | null;
      price: unknown;
      currency: string;
      interval: string;
      trialDays: number;
      mpPreapprovalPlanId: string | null;
    }>
  ) {
    let created = 0;
    let updated = 0;
    for (const plan of plans) {
      const amount = Number(plan.price);
      const result = await this.provider.ensurePreapprovalPlan({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        amount,
        currency: plan.currency,
        interval: plan.interval,
        trialDays: plan.trialDays,
        mpPreapprovalPlanId: plan.mpPreapprovalPlanId
      });
      if (!result.preapprovalPlanId) continue;
      if (plan.mpPreapprovalPlanId !== result.preapprovalPlanId) {
        await this.repository.updatePlanMpPreapprovalId(plan.id, result.preapprovalPlanId);
        if (plan.mpPreapprovalPlanId) updated += 1;
        else created += 1;
      }
    }
    return { created, updated, total: plans.length };
  }
}

const billingRepository = new PrismaBillingRepository();
const billingProvider = new MercadoPagoBillingProvider();
export const billingService = new BillingService(billingRepository, billingProvider);
