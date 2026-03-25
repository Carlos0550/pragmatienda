import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionToken, isSessionActive } = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  isSessionActive: vi.fn()
}));

vi.mock("../../src/config/security", () => ({
  verifySessionToken,
  isSessionActive
}));

import { attachAuthenticatedUserOptional } from "../../src/middlewares/auth.middleware";

describe("attachAuthenticatedUserOptional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues as guest when the bearer token is invalid", async () => {
    verifySessionToken.mockImplementation(() => {
      throw new Error("JWT invalido");
    });

    const req = {
      header: vi.fn((name: string) => {
        if (name === "authorization" || name === "Authorization") {
          return "Bearer invalid-token";
        }
        return undefined;
      })
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const next = vi.fn();

    await attachAuthenticatedUserOptional(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("continues as guest when the session token is inactive", async () => {
    verifySessionToken.mockReturnValue({
      id: "user-1",
      email: "customer@test.com",
      role: 2
    });
    isSessionActive.mockResolvedValue(false);

    const req = {
      header: vi.fn((name: string) => {
        if (name === "authorization" || name === "Authorization") {
          return "Bearer inactive-token";
        }
        return undefined;
      })
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as any;
    const next = vi.fn();

    await attachAuthenticatedUserOptional(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
