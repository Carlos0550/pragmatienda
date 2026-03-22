import { BillingStatus, PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "../../src/billing/application/billing.service";
import type { BillingProvider } from "../../src/billing/domain/billing-provider";
import type { PrismaBillingRepository } from "../../src/billing/infrastructure/prisma-billing.repository";

describe("BillingService.assignPlanManually", () => {
  it("creates a local active subscription, records an audit event, and syncs the tenant snapshot", async () => {
    const provider = {
      ensurePreapprovalPlan: vi.fn(),
      updatePreapprovalPlan: vi.fn(),
      setPreapprovalPlanStatus: vi.fn(),
      createSubscription: vi.fn(),
      getSubscription: vi.fn(),
      changeSubscriptionPlan: vi.fn(),
      searchSubscriptionsByStatus: vi.fn()
    } as unknown as BillingProvider;

    const repository = {
      getTenantWithOwner: vi.fn(async () => ({
        id: "tenant-1",
        owner: { id: "owner-1", email: "owner@test.com" },
        planEndsAt: null,
        billingStatus: BillingStatus.ACTIVE,
        plan: PlanType.FREE,
        trialEndsAt: null
      })),
      getPlanByCode: vi.fn(async () => ({
        id: "plan-pro",
        code: PlanType.PRO,
        name: "Pro",
        description: null,
        price: 24999,
        currency: "ARS",
        interval: "month",
        trialDays: 7,
        mpPreapprovalPlanId: "mp-plan-pro",
        active: true
      })),
      createSubscription: vi.fn(async () => ({
        id: "sub-manual-1"
      })),
      createSubscriptionEvent: vi.fn(),
      getSubscriptionByExternalId: vi.fn(async (externalSubscriptionId: string) => ({
        id: "sub-manual-1",
        tenantId: "tenant-1",
        planId: "plan-pro",
        externalSubscriptionId,
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-03-21T10:00:00.000Z"),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-03-21T10:00:00.000Z"),
        updatedAt: new Date("2026-03-21T10:00:00.000Z"),
        plan: {
          id: "plan-pro",
          code: PlanType.PRO,
          name: "Pro"
        },
        tenant: {
          id: "tenant-1",
          ownerId: "owner-1",
          plan: PlanType.FREE,
          billingStatus: BillingStatus.ACTIVE,
          planStartsAt: new Date("2026-01-01T00:00:00.000Z"),
          planEndsAt: null,
          trialEndsAt: null,
          currentSubscriptionId: "free-sub-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z")
        }
      })),
      setTenantBillingSnapshot: vi.fn()
    } as unknown as PrismaBillingRepository;

    const service = new BillingService(repository, provider);
    const result = await service.assignPlanManually("tenant-1", PlanType.PRO);

    expect(repository.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        planId: "plan-pro",
        status: BillingStatus.ACTIVE,
        currentPeriodEnd: null
      })
    );
    expect(repository.createSubscriptionEvent).toHaveBeenCalledWith(
      "sub-manual-1",
      "subscription.assigned_manually",
      expect.objectContaining({
        source: "script",
        planCode: PlanType.PRO
      })
    );
    expect(repository.setTenantBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        planCode: PlanType.PRO,
        billingStatus: BillingStatus.ACTIVE,
        currentSubscriptionId: "sub-manual-1"
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        subscriptionId: "sub-manual-1",
        planId: "plan-pro",
        planCode: PlanType.PRO
      })
    );
    expect(result.externalSubscriptionId).toMatch(/^manual-tenant-1-PRO-\d+$/);
  });
});
