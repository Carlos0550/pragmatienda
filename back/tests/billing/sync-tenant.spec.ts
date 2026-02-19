import { BillingStatus, PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "../../src/billing/application/billing.service";
import type { BillingProvider } from "../../src/billing/domain/billing-provider";
import type { PrismaBillingRepository } from "../../src/billing/infrastructure/prisma-billing.repository";

describe("BillingService.syncTenantWithSubscription", () => {
  it("synchronizes tenant cached billing fields", async () => {
    const repository = {
      getSubscriptionByExternalId: vi.fn(async () => ({
        id: "sub-local-1",
        externalSubscriptionId: "sub-mp-1",
        tenantId: "tenant-1",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        plan: {
          id: "plan-pro",
          code: PlanType.PRO,
          name: "Pro"
        }
      })),
      setTenantBillingSnapshot: vi.fn()
    } as unknown as PrismaBillingRepository;

    const provider = {
      ensurePreapprovalPlan: vi.fn(),
      updatePreapprovalPlan: vi.fn(),
      createSubscription: vi.fn(),
      getSubscription: vi.fn(),
      changeSubscriptionPlanAmount: vi.fn(),
      searchSubscriptionsByStatus: vi.fn()
    } as unknown as BillingProvider;

    const service = new BillingService(repository, provider);
    await service.syncTenantWithSubscription("sub-mp-1");

    expect(repository.setTenantBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        planCode: PlanType.PRO,
        billingStatus: BillingStatus.ACTIVE
      })
    );
  });
});
