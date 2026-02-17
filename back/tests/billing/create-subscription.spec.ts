import { BillingStatus, PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "../../src/billing/application/billing.service";
import type { BillingProvider } from "../../src/billing/domain/billing-provider";
import type { PrismaBillingRepository } from "../../src/billing/infrastructure/prisma-billing.repository";

describe("BillingService.createSubscriptionForTenant", () => {
  it("creates a subscription using tenant owner email and selected plan", async () => {
    const provider: BillingProvider = {
      ensurePreapprovalPlan: vi.fn(),
      createSubscription: vi.fn(async () => ({
        externalSubscriptionId: "sub_mp_1",
        status: "pending",
        initPoint: "https://mp.test/sub",
        currentPeriodStart: null,
        currentPeriodEnd: null
      })),
      getSubscription: vi.fn(),
      changeSubscriptionPlanAmount: vi.fn(),
      searchSubscriptionsByStatus: vi.fn()
    };

    const repository = {
      getTenantWithOwner: vi.fn(async () => ({
        id: "tenant-1",
        owner: { id: "owner-1", email: "owner@test.com" },
        planEndsAt: null,
        billingStatus: BillingStatus.INACTIVE,
        plan: PlanType.FREE,
        trialEndsAt: null
      })),
      getPlanByCode: vi.fn(async () => ({
        id: "plan-starter",
        code: PlanType.STARTER,
        name: "Starter",
        description: null,
        price: 12000,
        currency: "ARS",
        interval: "month",
        trialDays: 7,
        mpPreapprovalPlanId: "plan_mp_1",
        active: true
      })),
      createSubscription: vi.fn(async () => ({
        id: "sub-local-1"
      })),
      createSubscriptionEvent: vi.fn()
    } as unknown as PrismaBillingRepository;

    const service = new BillingService(repository, provider);
    const result = await service.createSubscriptionForTenant("tenant-1", PlanType.STARTER);

    expect(result.externalSubscriptionId).toBe("sub_mp_1");
    expect(provider.createSubscription).toHaveBeenCalledOnce();
    expect(provider.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        ownerEmail: "owner@test.com",
        planCode: PlanType.STARTER
      })
    );
  });
});
