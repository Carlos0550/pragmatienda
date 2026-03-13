import { BillingStatus, PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "../../src/billing/application/billing.service";
import type { BillingProvider } from "../../src/billing/domain/billing-provider";
import type { PrismaBillingRepository } from "../../src/billing/infrastructure/prisma-billing.repository";

describe("BillingService plan changes and current subscription resolution", () => {
  it("updates plan terms and syncs tenant snapshot after changing plan", async () => {
    const provider: BillingProvider = {
      ensurePreapprovalPlan: vi.fn(),
      updatePreapprovalPlan: vi.fn(),
      setPreapprovalPlanStatus: vi.fn(),
      createSubscription: vi.fn(),
      getSubscription: vi.fn(async () => ({
        externalSubscriptionId: "sub_mp_1",
        externalReference: "tenant-1",
        status: "authorized",
        currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        raw: { status: "authorized" }
      })),
      changeSubscriptionPlan: vi.fn(async () => ({
        externalSubscriptionId: "sub_mp_1",
        externalReference: "tenant-1",
        status: "authorized",
        currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        raw: { status: "authorized" }
      })),
      searchSubscriptionsByStatus: vi.fn()
    };

    const repository = {
      getPlanByCode: vi
        .fn()
        .mockResolvedValueOnce({
          id: "plan-pro",
          code: PlanType.PRO,
          name: "Pro",
          price: 24000,
          currency: "ARS",
          interval: "year",
          trialDays: 7,
          active: true
        }),
      getTenantCurrentSubscription: vi.fn(async () => ({
        id: "sub-local-1",
        tenantId: "tenant-1",
        planId: "plan-starter",
        externalSubscriptionId: "sub_mp_1",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-02-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-03-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        plan: {
          id: "plan-starter",
          code: PlanType.STARTER,
          name: "Starter"
        }
      })),
      upsertSubscriptionByExternalId: vi.fn(async () => ({
        id: "sub-local-1",
        tenantId: "tenant-1",
        planId: "plan-pro",
        externalSubscriptionId: "sub_mp_1",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
        plan: {
          id: "plan-pro",
          code: PlanType.PRO,
          name: "Pro"
        }
      })),
      createSubscriptionEvent: vi.fn(),
      getSubscriptionByExternalId: vi.fn(async () => ({
        id: "sub-local-1",
        tenantId: "tenant-1",
        planId: "plan-pro",
        externalSubscriptionId: "sub_mp_1",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
        plan: {
          id: "plan-pro",
          code: PlanType.PRO,
          name: "Pro"
        }
      })),
      setTenantBillingSnapshot: vi.fn()
    } as unknown as PrismaBillingRepository;

    const service = new BillingService(repository, provider);
    const result = await service.changeSubscriptionPlan("tenant-1", PlanType.PRO);

    expect(provider.changeSubscriptionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        externalSubscriptionId: "sub_mp_1",
        planCode: PlanType.PRO,
        planName: "Pro",
        amount: 24000,
        currency: "ARS",
        interval: "year"
      })
    );
    expect(provider.getSubscription).toHaveBeenCalledWith("sub_mp_1");
    expect(repository.setTenantBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        planCode: PlanType.PRO,
        currentSubscriptionId: "sub-local-1"
      })
    );
    expect(result).toEqual({
      subscriptionId: "sub-local-1",
      externalSubscriptionId: "sub_mp_1"
    });
  });

  it("repairs tenant current subscription snapshot when only a legacy latest subscription exists", async () => {
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
      getTenantCurrentSubscription: vi.fn(async () => null),
      getLatestSubscriptionForTenant: vi.fn(async () => ({
        id: "sub-legacy-1",
        tenantId: "tenant-1",
        planId: "plan-starter",
        externalSubscriptionId: "sub_mp_legacy",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-15T00:00:00.000Z"),
        plan: {
          id: "plan-starter",
          code: PlanType.STARTER,
          name: "Starter",
          price: 12000,
          currency: "ARS",
          interval: "month",
          trialDays: 7,
          description: "Starter",
          active: true,
          maxProducts: 100,
          maxCategories: 10,
          features: { reports: true }
        }
      })),
      setTenantBillingSnapshot: vi.fn()
    } as unknown as PrismaBillingRepository;

    const service = new BillingService(repository, provider);
    const current = await service.getCurrentSubscription("tenant-1");

    expect(repository.setTenantBillingSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        currentSubscriptionId: "sub-legacy-1"
      })
    );
    expect(current?.id).toBe("sub-legacy-1");
    expect(current?.plan.code).toBe(PlanType.STARTER);
  });
});
