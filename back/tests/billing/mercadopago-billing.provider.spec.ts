import { PlanType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { BillingError } from "../../src/billing/domain/billing-errors";
import { MercadoPagoBillingProvider } from "../../src/billing/infrastructure/mercadopago-billing.provider";

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(_config: unknown) {}
  }

  class PreApproval {
    async get({ id }: { id: string }) {
      return {
        id,
        external_reference: "tenant-1",
        status: "authorized",
        reason: "Starter",
        date_created: "2026-03-01T00:00:00.000Z",
        next_payment_date: "2026-04-01T00:00:00.000Z",
        auto_recurring: {
          transaction_amount: 12000,
          currency_id: "ARS"
        }
      };
    }

    async update() {
      throw {
        message: "Unauthorized access to resource.",
        status: 401
      };
    }
  }

  class PreApprovalPlan {}

  return { MercadoPagoConfig, PreApproval, PreApprovalPlan };
});

describe("MercadoPagoBillingProvider.changeSubscriptionPlan", () => {
  it("translates provider authorization errors into BillingError", async () => {
    const provider = new MercadoPagoBillingProvider();

    await expect(
      provider.changeSubscriptionPlan({
        externalSubscriptionId: "sub_mp_1",
        planCode: PlanType.PRO,
        planName: "Pro",
        amount: 24000,
        currency: "ARS",
        interval: "month"
      })
    ).rejects.toMatchObject<BillingError>({
      status: 502,
      code: "PROVIDER_ERROR",
      message:
        "Mercado Pago rechazó la operación por permisos insuficientes o porque la suscripción no pertenece a la cuenta configurada.",
      details: expect.objectContaining({
        providerMessage: "Unauthorized access to resource.",
        providerStatus: 401
      })
    });
  });
});
