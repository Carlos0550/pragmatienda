import { BillingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  tenantFindUnique,
  userFindFirst,
  verifySessionToken,
  isSessionActive
} = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  verifySessionToken: vi.fn(),
  isSessionActive: vi.fn()
}));

vi.mock("../../src/db/prisma", () => ({
  prisma: {
    tenant: { findUnique: tenantFindUnique },
    user: { findFirst: userFindFirst }
  }
}));

vi.mock("../../src/config/security", () => ({
  verifySessionToken,
  isSessionActive
}));

import { requireTenant } from "../../src/middlewares/tenant.middleware";

describe("requireTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects cross-tenant access even when req.user was not preloaded yet", async () => {
    verifySessionToken.mockReturnValue({
      id: "user-1",
      email: "owner@test.com",
      role: 1
    });
    isSessionActive.mockResolvedValue(true);
    tenantFindUnique.mockResolvedValue({
      id: "tenant-2",
      billingStatus: BillingStatus.ACTIVE,
      planEndsAt: null
    });
    userFindFirst.mockResolvedValue(null);

    const req = {
      header: vi.fn((name: string) => {
        if (name === "x-tenant-id") return "tenant-2";
        if (name === "authorization" || name === "Authorization") return "Bearer session-token";
        return undefined;
      }),
      originalUrl: "/api/admin/business"
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const next = vi.fn();

    await requireTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario no pertenece al tenant."
    });
    expect(next).not.toHaveBeenCalled();
  });
});
