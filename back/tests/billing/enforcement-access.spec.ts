import { BillingStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ensureTenantHasActiveSubscription } from "../../src/middlewares/subscription.middleware";

describe("ensureTenantHasActiveSubscription", () => {
  it("allows ACTIVE tenants", () => {
    const req = { originalUrl: "/api/admin/products" } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const result = ensureTenantHasActiveSubscription(req, res, {
      billingStatus: BillingStatus.ACTIVE,
      planEndsAt: null
    });
    expect(result).toBe(true);
  });

  it("blocks EXPIRED tenants after plan end", () => {
    const req = { originalUrl: "/api/admin/products" } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const result = ensureTenantHasActiveSubscription(req, res, {
      billingStatus: BillingStatus.EXPIRED,
      planEndsAt: new Date(Date.now() - 60_000)
    });
    expect(result).not.toBe(true);
    expect(res.status).toHaveBeenCalledWith(402);
  });
});
