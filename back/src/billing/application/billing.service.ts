import { BillingStatus, PlanType, Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { BillingError } from "../domain/billing-errors";
import { mapMercadoPagoPreapprovalStatus } from "../domain/billing-status.mapper";
import type { BillingProvider } from "../domain/billing-provider";
import { MercadoPagoBillingProvider } from "../infrastructure/mercadopago-billing.provider";
import { PrismaBillingRepository } from "../infrastructure/prisma-billing.repository";

const BILLING_WEBHOOK_PROVIDER = "MERCADOPAGO_BILLING";

const toJsonValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

const webhookEventId = (subscriptionId: string, webhookId: string) =>
  `preapproval:${subscriptionId}:${webhookId || "unknown"}`;

export class BillingService {
  constructor(
    private readonly repository: PrismaBillingRepository,
    private readonly provider: BillingProvider
  ) {}

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

    const storeSuccessUrl = tenant.businessData?.website
      ? `${tenant.businessData.website.replace(/\/$/, "")}/admin/billing`
      : tenant.businessData?.name
        ? `https://${tenant.businessData.name}.pragmatienda.com/admin/billing`
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

    if (!billing.externalSubscriptionId && billing.initPoint) {
      return {
        subscriptionId: null,
        externalSubscriptionId: null,
        initPoint: billing.initPoint
      };
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

    return {
      subscriptionId: subscription.id,
      externalSubscriptionId: billing.externalSubscriptionId,
      initPoint: billing.initPoint
    };
  }

  async handlePreapprovalWebhook(payload: Record<string, unknown>) {
    const dataIdRaw =
      typeof payload.data === "object" && payload.data !== null && "id" in payload.data
        ? (payload.data as { id?: unknown }).id
        : payload["id"];
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
    let tenantId = snapshot.externalReference;

    if (!tenantId && snapshot.payerEmail) {
      const tenantByEmail = await this.repository.getTenantByOwnerEmail(snapshot.payerEmail);
      if (tenantByEmail) {
        tenantId = tenantByEmail.id;
      }
    }

    if (!tenantId) {
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

    let plan = await this.repository.getCurrentSubscriptionForTenant(tenantId);
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

    const current = await this.repository.getCurrentSubscriptionForTenant(tenantId);
    if (!current) {
      throw new BillingError(404, "SUBSCRIPTION_NOT_FOUND", "No hay suscripción activa para cambiar plan.");
    }

    await this.provider.changeSubscriptionPlanAmount(
      current.externalSubscriptionId,
      Number(plan.price),
      plan.currency
    );

    await this.repository.upsertSubscriptionByExternalId({
      tenantId,
      planId: plan.id,
      externalSubscriptionId: current.externalSubscriptionId,
      status: current.status,
      currentPeriodStart: current.currentPeriodStart,
      currentPeriodEnd: current.currentPeriodEnd,
      cancelAtPeriodEnd: current.cancelAtPeriodEnd
    });

    await this.repository.createSubscriptionEvent(
      current.id,
      "subscription.plan_changed",
      toJsonValue({
        newPlanCode: planCode,
        amount: Number(plan.price)
      })
    );

    return { subscriptionId: current.id, externalSubscriptionId: current.externalSubscriptionId };
  }

  async syncActiveSubscriptionsJob() {
    const statuses: Array<"authorized" | "pending"> = ["authorized", "pending"];
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
        const current = await this.repository.getCurrentSubscriptionForTenant(snapshot.externalReference);
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
        await this.repository.setTenantBillingSnapshot({
          tenantId: tenant.id,
          billingStatus: subscription.status,
          planCode: plan.code,
          planStartsAt: subscription.currentPeriodStart ?? tenant.planStartsAt,
          planEndsAt: subscription.currentPeriodEnd ?? tenant.planEndsAt,
          currentSubscriptionId: subscription.id
        });
        processed += 1;
      }
    }

    return { processed };
  }

  async syncPreapprovalPlans() {
    const plans = await this.repository.getAllPlans();
    let synced = 0;
    for (const plan of plans) {
      const result = await this.provider.ensurePreapprovalPlan({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        amount: Number(plan.price),
        currency: plan.currency,
        interval: plan.interval,
        trialDays: plan.trialDays,
        mpPreapprovalPlanId: plan.mpPreapprovalPlanId
      });
      if (result.preapprovalPlanId && plan.mpPreapprovalPlanId !== result.preapprovalPlanId) {
        await this.repository.updatePlanMpPreapprovalId(plan.id, result.preapprovalPlanId);
        synced += 1;
      }
    }
    return { synced };
  }
}

const billingRepository = new PrismaBillingRepository();
const billingProvider = new MercadoPagoBillingProvider();
export const billingService = new BillingService(billingRepository, billingProvider);
