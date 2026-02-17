import { BillingStatus, PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "../../src/billing/application/billing.service";
import type { BillingProvider } from "../../src/billing/domain/billing-provider";
import type { PrismaBillingRepository } from "../../src/billing/infrastructure/prisma-billing.repository";

describe("BillingService.handlePreapprovalWebhook", () => {
  it("updates subscription and tenant snapshot from preapproval webhook", async () => {
    const provider: BillingProvider = {
      ensurePreapprovalPlan: vi.fn(),
      createSubscription: vi.fn(),
      getSubscription: vi.fn(async () => ({
        externalSubscriptionId: "sub_mp_1",
        externalReference: "tenant-1",
        status: "authorized",
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        reason: "Starter",
        autoRecurringAmount: 12000,
        autoRecurringCurrency: "ARS",
        cancelAtPeriodEnd: false,
        raw: { status: "authorized" }
      })),
      changeSubscriptionPlanAmount: vi.fn(),
      searchSubscriptionsByStatus: vi.fn()
    };

    const repository = {
      getTenantWithOwner: vi.fn(async () => ({
        id: "tenant-1",
        owner: { id: "owner-1", email: "owner@test.com" },
        planEndsAt: null,
        billingStatus: BillingStatus.INACTIVE,
        plan: PlanType.STARTER,
        trialEndsAt: null
      })),
      getCurrentSubscriptionForTenant: vi.fn(async () => ({
        id: "local-sub",
        tenantId: "tenant-1",
        planId: "plan-starter",
        externalSubscriptionId: "sub_mp_1",
        status: BillingStatus.INACTIVE,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: "plan-starter",
          code: PlanType.STARTER,
          name: "Starter"
        }
      })),
      upsertSubscriptionByExternalId: vi.fn(async () => ({
        id: "local-sub",
        tenantId: "tenant-1",
        planId: "plan-starter",
        externalSubscriptionId: "sub_mp_1",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: "plan-starter",
          code: PlanType.STARTER,
          name: "Starter"
        }
      })),
      upsertWebhookEvent: vi.fn(),
      createSubscriptionEvent: vi.fn(),
      getSubscriptionByExternalId: vi.fn(async () => ({
        id: "local-sub",
        tenantId: "tenant-1",
        planId: "plan-starter",
        externalSubscriptionId: "sub_mp_1",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: "plan-starter",
          code: PlanType.STARTER,
          name: "Starter"
        }
      })),
      setTenantBillingSnapshot: vi.fn()
    } as unknown as PrismaBillingRepository;

    const service = new BillingService(repository, provider);
    const result = await service.handlePreapprovalWebhook({
      type: "preapproval",
      id: "webhook-1",
      data: { id: "sub_mp_1" }
    });

    expect(result.tenantId).toBe("tenant-1");
    expect(repository.setTenantBillingSnapshot).toHaveBeenCalledOnce();
    expect(repository.setTenantBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        billingStatus: BillingStatus.ACTIVE
      })
    );
  });
});
