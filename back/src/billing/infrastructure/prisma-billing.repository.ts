import { BillingStatus, PlanType, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

export class PrismaBillingRepository {
  async getTenantWithOwner(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        owner: {
          select: {
            id: true,
            email: true
          }
        },
        planStartsAt: true,
        planEndsAt: true,
        billingStatus: true,
        plan: true,
        trialEndsAt: true,
        businessData: {
          select: { name: true, website: true }
        }
      }
    });
  }

  async getPlanByCode(code: PlanType) {
    return prisma.plan.findUnique({
      where: { code }
    });
  }

  async getPlanByMpPreapprovalPlanId(mpPreapprovalPlanId: string) {
    return prisma.plan.findFirst({
      where: { mpPreapprovalPlanId }
    });
  }

  async getTenantByOwnerEmail(ownerEmail: string) {
    return prisma.tenant.findFirst({
      where: {
        owner: { email: ownerEmail }
      },
      select: {
        id: true,
        owner: {
          select: { id: true, email: true }
        },
        planStartsAt: true,
        planEndsAt: true,
        billingStatus: true,
        plan: true,
        trialEndsAt: true
      }
    });
  }

  async getAllPlans() {
    return prisma.plan.findMany({
      where: { active: true }
    });
  }

  async updatePlanMpPreapprovalId(planId: string, mpPreapprovalPlanId: string) {
    return prisma.plan.update({
      where: { id: planId },
      data: { mpPreapprovalPlanId }
    });
  }

  async createSubscription(input: {
    tenantId: string;
    planId: string;
    externalSubscriptionId: string;
    status: BillingStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }) {
    return prisma.subscription.create({
      data: {
        tenantId: input.tenantId,
        planId: input.planId,
        externalSubscriptionId: input.externalSubscriptionId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null
      }
    });
  }

  async upsertSubscriptionByExternalId(input: {
    tenantId: string;
    planId: string;
    externalSubscriptionId: string;
    status: BillingStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }) {
    return prisma.subscription.upsert({
      where: {
        externalSubscriptionId: input.externalSubscriptionId
      },
      update: {
        tenantId: input.tenantId,
        planId: input.planId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false
      },
      create: {
        tenantId: input.tenantId,
        planId: input.planId,
        externalSubscriptionId: input.externalSubscriptionId,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false
      }
    });
  }

  async getSubscriptionByExternalId(externalSubscriptionId: string) {
    return prisma.subscription.findUnique({
      where: { externalSubscriptionId },
      include: { plan: true, tenant: true }
    });
  }

  async getCurrentSubscriptionForTenant(tenantId: string) {
    return prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      include: { plan: true }
    });
  }

  async createSubscriptionEvent(subscriptionId: string, type: string, payload: Prisma.InputJsonValue) {
    return prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        type,
        payload
      }
    });
  }

  async setTenantBillingSnapshot(input: {
    tenantId: string;
    billingStatus: BillingStatus;
    planCode: PlanType;
    planStartsAt?: Date | null;
    planEndsAt?: Date | null;
    currentSubscriptionId?: string | null;
  }) {
    return prisma.tenant.update({
      where: { id: input.tenantId },
      data: {
        billingStatus: input.billingStatus,
        plan: input.planCode,
        planStartsAt: input.planStartsAt ?? undefined,
        planEndsAt: input.planEndsAt ?? null,
        currentSubscriptionId: input.currentSubscriptionId ?? null
      }
    });
  }

  async upsertWebhookEvent(
    tenantId: string,
    provider: string,
    eventId: string,
    eventType: string,
    payload: Prisma.InputJsonValue
  ) {
    return prisma.paymentEvent.upsert({
      where: {
        provider_eventId: {
          provider,
          eventId
        }
      },
      update: {
        eventType,
        payload,
        processedAt: new Date()
      },
      create: {
        tenantId,
        provider,
        eventId,
        eventType,
        payload
      }
    });
  }

  async findSubscriptionsForSync() {
    return prisma.subscription.findMany({
      where: {
        status: {
          in: [BillingStatus.ACTIVE, BillingStatus.TRIALING, BillingStatus.PAST_DUE]
        }
      },
      include: {
        plan: true
      }
    });
  }
}
