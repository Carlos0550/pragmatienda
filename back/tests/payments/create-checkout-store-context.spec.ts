import { describe, expect, it, vi } from "vitest";
import { PaymentsService } from "../../src/payments/application/payments.service";
import { PaymentProviderRegistry } from "../../src/payments/application/payment-provider.registry";
import type { PaymentProvider } from "../../src/payments/domain/payment-provider";
import type { PrismaPaymentsRepository } from "../../src/payments/infrastructure/prisma-payments.repository";

describe("PaymentsService.createMercadoPagoCheckout", () => {
  it("uses the store context from the order to create checkout", async () => {
    const createCheckout = vi.fn(async () => ({
      externalReference: "order-1",
      checkoutUrl: "https://mp.test/init",
      preferenceId: "pref_1"
    }));

    const provider: PaymentProvider = {
      providerCode: "MERCADOPAGO",
      connectAccount: vi.fn(),
      completeConnection: vi.fn(),
      createCheckout,
      handleWebhook: vi.fn(),
      refreshToken: vi.fn()
    };

    const registry = new PaymentProviderRegistry();
    registry.register(provider);

    const repository = {
      getOrderForCheckout: vi.fn(async () => ({
        id: "order-1",
        tenantId: "store-abc",
        currency: "ARS",
        total: 150,
        user: { email: "buyer@example.com" },
        items: [
          {
            productId: "prod-1",
            quantity: 2,
            unitPrice: 75,
            product: { name: "Producto test", image: null }
          }
        ]
      }))
    } as unknown as PrismaPaymentsRepository;

    const service = new PaymentsService(registry, repository);
    await service.createMercadoPagoCheckout("store-abc", "order-1", "idem-12345678");

    expect(createCheckout).toHaveBeenCalledOnce();
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-abc",
        orderId: "order-1"
      })
    );
  });
});
