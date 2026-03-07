import { BillingStatus, PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingError } from "../../src/billing/domain/billing-errors";
import { PlanCapabilitiesService } from "../../src/billing/application/plan-capabilities.service";
import type { PrismaBillingRepository } from "../../src/billing/infrastructure/prisma-billing.repository";

const createMockRepo = (overrides: Partial<{
  getCurrentSubscriptionForTenant: PrismaBillingRepository["getCurrentSubscriptionForTenant"];
  getTenantWithOwner: PrismaBillingRepository["getTenantWithOwner"];
  getPlanByCode: PrismaBillingRepository["getPlanByCode"];
  countProductsByTenant: PrismaBillingRepository["countProductsByTenant"];
  countCategoriesByTenant: PrismaBillingRepository["countCategoriesByTenant"];
}> = {}) => ({
  getCurrentSubscriptionForTenant: vi.fn(),
  getTenantWithOwner: vi.fn(),
  getPlanByCode: vi.fn(),
  countProductsByTenant: vi.fn(),
  countCategoriesByTenant: vi.fn(),
  ...overrides
} as unknown as PrismaBillingRepository);

describe("PlanCapabilitiesService", () => {
  it("assertCanCreateProduct throws PLAN_LIMIT_REACHED when usage >= maxProducts", async () => {
    const repo = createMockRepo({
      getCurrentSubscriptionForTenant: vi.fn().mockResolvedValue({
        plan: {
          id: "plan-1",
          code: PlanType.STARTER,
          maxProducts: 10,
          maxCategories: 5,
          features: { reports: true }
        }
      }),
      countProductsByTenant: vi.fn().mockResolvedValue(10),
      countCategoriesByTenant: vi.fn().mockResolvedValue(0)
    });
    const service = new PlanCapabilitiesService(repo);

    await expect(service.assertCanCreateProduct("tenant-1")).rejects.toThrow(BillingError);
    await expect(service.assertCanCreateProduct("tenant-1")).rejects.toMatchObject({
      status: 402,
      code: "PLAN_LIMIT_REACHED",
      message: expect.stringContaining("límite de productos")
    });
  });

  it("assertCanCreateProduct does not throw when maxProducts is null", async () => {
    const repo = createMockRepo({
      getCurrentSubscriptionForTenant: vi.fn().mockResolvedValue({
        plan: {
          id: "plan-1",
          code: PlanType.PRO,
          maxProducts: null,
          maxCategories: null,
          features: {}
        }
      }),
      countProductsByTenant: vi.fn().mockResolvedValue(100),
      countCategoriesByTenant: vi.fn().mockResolvedValue(50)
    });
    const service = new PlanCapabilitiesService(repo);

    await expect(service.assertCanCreateProduct("tenant-1")).resolves.toBeUndefined();
  });

  it("assertCanCreateProduct does not throw when usage < maxProducts", async () => {
    const repo = createMockRepo({
      getCurrentSubscriptionForTenant: vi.fn().mockResolvedValue({
        plan: {
          id: "plan-1",
          code: PlanType.STARTER,
          maxProducts: 10,
          maxCategories: 5,
          features: {}
        }
      }),
      countProductsByTenant: vi.fn().mockResolvedValue(5),
      countCategoriesByTenant: vi.fn().mockResolvedValue(2)
    });
    const service = new PlanCapabilitiesService(repo);

    await expect(service.assertCanCreateProduct("tenant-1")).resolves.toBeUndefined();
  });

  it("assertCanCreateCategory throws PLAN_LIMIT_REACHED when usage >= maxCategories", async () => {
    const repo = createMockRepo({
      getCurrentSubscriptionForTenant: vi.fn().mockResolvedValue({
        plan: {
          id: "plan-1",
          code: PlanType.FREE,
          maxProducts: 10,
          maxCategories: 3,
          features: {}
        }
      }),
      countProductsByTenant: vi.fn().mockResolvedValue(0),
      countCategoriesByTenant: vi.fn().mockResolvedValue(3)
    });
    const service = new PlanCapabilitiesService(repo);

    await expect(service.assertCanCreateCategory("tenant-1")).rejects.toThrow(BillingError);
    await expect(service.assertCanCreateCategory("tenant-1")).rejects.toMatchObject({
      status: 402,
      code: "PLAN_LIMIT_REACHED",
      message: expect.stringContaining("límite de categorías")
    });
  });

  it("assertFeature throws FEATURE_NOT_AVAILABLE when feature is not enabled", async () => {
    const repo = createMockRepo({
      getCurrentSubscriptionForTenant: vi.fn().mockResolvedValue({
        plan: {
          id: "plan-1",
          code: PlanType.STARTER,
          maxProducts: 10,
          maxCategories: 5,
          features: { reports: true }
        }
      }),
      countProductsByTenant: vi.fn().mockResolvedValue(0),
      countCategoriesByTenant: vi.fn().mockResolvedValue(0)
    });
    const service = new PlanCapabilitiesService(repo);

    await expect(service.assertFeature("tenant-1", "api")).rejects.toThrow(BillingError);
    await expect(service.assertFeature("tenant-1", "api")).rejects.toMatchObject({
      status: 402,
      code: "FEATURE_NOT_AVAILABLE"
    });
  });

  it("assertFeature does not throw when feature is enabled", async () => {
    const repo = createMockRepo({
      getCurrentSubscriptionForTenant: vi.fn().mockResolvedValue({
        plan: {
          id: "plan-1",
          code: PlanType.PRO,
          maxProducts: null,
          maxCategories: null,
          features: { reports: true, api: true }
        }
      }),
      countProductsByTenant: vi.fn().mockResolvedValue(0),
      countCategoriesByTenant: vi.fn().mockResolvedValue(0)
    });
    const service = new PlanCapabilitiesService(repo);

    await expect(service.assertFeature("tenant-1", "api")).resolves.toBeUndefined();
  });
});
