import { PaymentProvider as PaymentProviderEnum } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { encryptString } from "../../src/config/security";
import { MercadoPagoProvider } from "../../src/payments/infrastructure/mercadopago.provider";
import type { PrismaPaymentsRepository } from "../../src/payments/infrastructure/prisma-payments.repository";

vi.mock("mercadopago", () => {
  class MercadoPagoConfig {
    constructor(_config: unknown) {}
  }
  class Payment {
    async get({ id }: { id: string }) {
      return {
        id: Number(id),
        external_reference: "order-1",
        status: "approved",
        status_detail: "accredited",
        transaction_amount: 100,
        currency_id: "ARS",
        payment_method_id: "visa"
      };
    }
  }
  class Preference {}
  return { MercadoPagoConfig, Payment, Preference };
});

class FakeRepository {
  public events = new Map<string, unknown>();
  public payments = new Map<string, unknown>();

  async findStoreAccountByMpUserId() {
    return {
      storeId: "store-1",
      provider: PaymentProviderEnum.MERCADOPAGO,
      mpUserId: "123",
      accessToken: encryptString("access-token"),
      refreshToken: encryptString("refresh-token"),
      publicKey: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  async findPaymentByExternalPaymentId() {
    return null;
  }

  async findStoreAccount() {
    return {
      storeId: "store-1",
      provider: PaymentProviderEnum.MERCADOPAGO,
      mpUserId: "123",
      accessToken: encryptString("access-token"),
      refreshToken: encryptString("refresh-token"),
      publicKey: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    };
  }

  async getOrderById() {
    return {
      id: "order-1",
      tenantId: "store-1"
    };
  }

  async upsertWebhookEvent(
    _storeId: string,
    _orderId: string | null,
    provider: string,
    eventId: string
  ) {
    this.events.set(`${provider}:${eventId}`, true);
  }

  async upsertPayment(input: { provider: PaymentProviderEnum; externalPaymentId: string }) {
    this.payments.set(`${input.provider}:${input.externalPaymentId}`, input);
  }

  async setOrderPaymentStatus() {
    return;
  }
}

describe("MercadoPago webhook idempotency", () => {
  it("processes duplicate webhook notifications without duplicating payment rows", async () => {
    const repository = new FakeRepository();
    const provider = new MercadoPagoProvider(repository as unknown as PrismaPaymentsRepository);

    await provider.handleWebhook({
      webhookId: "event-1",
      eventType: "payment",
      paymentId: "999",
      providerUserId: "123"
    });

    await provider.handleWebhook({
      webhookId: "event-1",
      eventType: "payment",
      paymentId: "999",
      providerUserId: "123"
    });

    expect(repository.events.size).toBe(1);
    expect(repository.payments.size).toBe(1);
  });
});
