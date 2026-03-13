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
        },
        tenant: {
          id: "tenant-1",
          ownerId: "owner-1",
          plan: PlanType.FREE,
          billingStatus: BillingStatus.INACTIVE,
          planStartsAt: new Date("2026-01-01T00:00:00.000Z"),
          planEndsAt: null,
          trialEndsAt: null,
          currentSubscriptionId: "sub-local-1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z")
        }
      })),
      setTenantBillingSnapshot: vi.fn()
    } as unknown as PrismaBillingRepository;

    const provider = {
      ensurePreapprovalPlan: vi.fn(),
      updatePreapprovalPlan: vi.fn(),
      setPreapprovalPlanStatus: vi.fn(),
      createSubscription: vi.fn(),
      getSubscription: vi.fn(),
      changeSubscriptionPlan: vi.fn(),
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

  it("does not replace current tenant snapshot with a new pending subscription", async () => {
    const repository = {
      getSubscriptionByExternalId: vi.fn(async () => ({
        id: "sub-local-2",
        externalSubscriptionId: "sub-mp-2",
        tenantId: "tenant-1",
        status: BillingStatus.INACTIVE,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        plan: {
          id: "plan-starter",
          code: PlanType.STARTER,
          name: "Starter"
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

    const provider = {
      ensurePreapprovalPlan: vi.fn(),
      updatePreapprovalPlan: vi.fn(),
      setPreapprovalPlanStatus: vi.fn(),
      createSubscription: vi.fn(),
      getSubscription: vi.fn(),
      changeSubscriptionPlan: vi.fn(),
      searchSubscriptionsByStatus: vi.fn()
    } as unknown as BillingProvider;

    const service = new BillingService(repository, provider);
    await service.syncTenantWithSubscription("sub-mp-2");

    expect(repository.setTenantBillingSnapshot).not.toHaveBeenCalled();
  });
});
