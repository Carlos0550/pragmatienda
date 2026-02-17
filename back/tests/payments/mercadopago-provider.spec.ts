import { describe, expect, it } from "vitest";
import { mapMercadoPagoStatusToPublicPaymentStatus } from "../../src/payments/domain/payment-status.mapper";
import { MercadoPagoProvider } from "../../src/payments/infrastructure/mercadopago.provider";
import type { PrismaPaymentsRepository } from "../../src/payments/infrastructure/prisma-payments.repository";

describe("MercadoPagoProvider", () => {
  it("builds oauth connect URL", async () => {
    const provider = new MercadoPagoProvider({} as PrismaPaymentsRepository);
    const result = await provider.connectAccount({
      storeId: "store-1",
      actorUserId: "user-1",
      state: "secure-state"
    });

    expect(result.authorizationUrl).toContain("auth.mercadopago.com/authorization");
    expect(result.authorizationUrl).toContain("response_type=code");
    expect(result.authorizationUrl).toContain("state=secure-state");
  });

  it("maps mercado pago statuses to public status contract", () => {
    expect(mapMercadoPagoStatusToPublicPaymentStatus("approved")).toBe("approved");
    expect(mapMercadoPagoStatusToPublicPaymentStatus("rejected")).toBe("rejected");
    expect(mapMercadoPagoStatusToPublicPaymentStatus("cancelled")).toBe("cancelled");
    expect(mapMercadoPagoStatusToPublicPaymentStatus("refunded")).toBe("refunded");
    expect(mapMercadoPagoStatusToPublicPaymentStatus("in_process")).toBe("pending");
  });
});
