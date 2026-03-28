import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShippingMethodKind, ShippingProviderCode, ShippingQuoteType } from "@prisma/client";

const {
  shippingMethodFindFirst,
  shippingMethodFindMany,
  shippingMethodCreate,
  shipnowConfigFindUnique,
  businessDataFindUnique,
  guestCartFindUnique,
  loggerError,
  loggerWarn,
  decimalToNumber,
  shipnowIsAvailable,
  shipnowGetRates,
} = vi.hoisted(() => ({
  shippingMethodFindFirst: vi.fn(),
  shippingMethodFindMany: vi.fn(),
  shippingMethodCreate: vi.fn(),
  shipnowConfigFindUnique: vi.fn(),
  businessDataFindUnique: vi.fn(),
  guestCartFindUnique: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  decimalToNumber: vi.fn((value: unknown) => Number(value)),
  shipnowIsAvailable: vi.fn(() => false),
  shipnowGetRates: vi.fn(),
}));

vi.mock("../../src/db/prisma", () => ({
  prisma: {
    shippingMethod: {
      findFirst: shippingMethodFindFirst,
      findMany: shippingMethodFindMany,
      create: shippingMethodCreate,
    },
    shipnowConfig: {
      findUnique: shipnowConfigFindUnique,
    },
    businessData: {
      findUnique: businessDataFindUnique,
    },
    guestCart: {
      findUnique: guestCartFindUnique,
    },
  },
}));

vi.mock("../../src/config/logger", () => ({
  logger: {
    error: loggerError,
    warn: loggerWarn,
  },
}));

vi.mock("../../src/services/Cart/checkout.helpers", () => ({
  CheckoutError: class CheckoutError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  decimalToNumber,
}));

vi.mock("../../src/services/Shipping/shipnow.service", () => ({
  shipnowService: {
    isAvailable: shipnowIsAvailable,
    getRates: shipnowGetRates,
  },
}));

import { ShippingService } from "../../src/services/Shipping/shipping.service";

describe("ShippingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    shipnowConfigFindUnique.mockResolvedValue({ acceptedTerms: true });
    shipnowIsAvailable.mockReturnValue(false);
    shipnowGetRates.mockReset();
    businessDataFindUnique.mockResolvedValue({
      name: "Negocio test",
      province: "Salta",
      phone: "3871234567",
      shippingOriginStreet: "Belgrano",
      shippingOriginNumber: "123",
      shippingOriginCity: "Salta",
      shippingOriginPostalCode: "4400",
    });
    shippingMethodFindFirst.mockResolvedValue(null);
    shippingMethodFindMany.mockResolvedValue([]);
    guestCartFindUnique.mockResolvedValue({
      items: [
        {
          productId: "product-1",
          quantity: 1,
          product: {
            id: "product-1",
            name: "Producto test",
            price: 1000,
            stock: 10,
            weightGrams: 500,
            lengthCm: 10,
            widthCm: 10,
            heightCm: 10,
          },
        },
      ],
    });
    shippingMethodCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "shipping-method-1",
      tenantId: "tenant-1",
      name: data.name,
      kind: data.kind,
      providerCode: data.providerCode,
      isActive: data.isActive ?? true,
      availableInCheckout: data.availableInCheckout ?? true,
      availableInAdmin: data.availableInAdmin ?? true,
      displayOrder: data.displayOrder ?? 0,
      config: data.config ?? null,
      zoneRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it("requires accepted ShipNow terms before creating a ShipNow method", async () => {
    shipnowConfigFindUnique.mockResolvedValue({ acceptedTerms: false });

    const service = new ShippingService();
    const result = await service.createMethod("tenant-1", {
      name: "Envío con ShipNow",
      kind: ShippingMethodKind.EXTERNAL,
      providerCode: ShippingProviderCode.SHIPNOW,
    });

    expect(result).toEqual({
      status: 400,
      message: "Debés aceptar los términos de ShipNow antes de configurarlo.",
    });
    expect(shippingMethodCreate).not.toHaveBeenCalled();
  });

  it("requires a complete business origin before creating a ShipNow method", async () => {
    businessDataFindUnique.mockResolvedValue({
      name: "Negocio test",
      province: "Salta",
      phone: "3871234567",
      shippingOriginStreet: "Belgrano",
      shippingOriginNumber: "123",
      shippingOriginCity: null,
      shippingOriginPostalCode: "4400",
    });

    const service = new ShippingService();
    const result = await service.createMethod("tenant-1", {
      name: "Envío con ShipNow",
      kind: ShippingMethodKind.EXTERNAL,
      providerCode: ShippingProviderCode.SHIPNOW,
    });

    expect(result).toEqual({
      status: 400,
      message: "Completá ciudad en Mi Negocio para usar ShipNow.",
    });
    expect(shippingMethodCreate).not.toHaveBeenCalled();
  });

  it("rejects duplicated singleton providers for the same tenant", async () => {
    shippingMethodFindFirst.mockResolvedValue({ id: "shipping-method-existing" });

    const service = new ShippingService();
    const result = await service.createMethod("tenant-1", {
      name: "Envío con ShipNow",
      kind: ShippingMethodKind.EXTERNAL,
      providerCode: ShippingProviderCode.SHIPNOW,
    });

    expect(result).toEqual({
      status: 409,
      message: "Ya existe un método ShipNow configurado para este negocio.",
    });
    expect(shippingMethodCreate).not.toHaveBeenCalled();
  });

  it("returns ShipNow as unavailable during quoting when the business origin is incomplete", async () => {
    shipnowIsAvailable.mockReturnValue(true);
    businessDataFindUnique.mockResolvedValue({
      name: "Negocio test",
      province: "Salta",
      phone: "3871234567",
      shippingOriginStreet: "Belgrano",
      shippingOriginNumber: "123",
      shippingOriginCity: null,
      shippingOriginPostalCode: "4400",
      address: "Belgrano 123",
      businessHours: "9 a 18",
    });
    shippingMethodFindMany.mockResolvedValue([
      {
        id: "shipping-method-shipnow",
        tenantId: "tenant-1",
        name: "Envío con ShipNow",
        kind: ShippingMethodKind.THIRD_PARTY,
        providerCode: ShippingProviderCode.SHIPNOW,
        isActive: true,
        availableInCheckout: true,
        availableInAdmin: true,
        displayOrder: 0,
        config: null,
        zoneRules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const service = new ShippingService();
    const result = await service.quoteForCart({
      tenantId: "tenant-1",
      guestCartToken: "guest-token",
      quoteType: ShippingQuoteType.HOME_DELIVERY,
      shippingAddress: {
        recipientName: "Carlos Test",
        recipientPhone: "3871234567",
        streetName: "Tarelli",
        streetNumber: "233",
        postalCode: "3308",
        city: "Candelaria",
        province: "Misiones",
        country: "Argentina",
      },
    });

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      items: [
        {
          shippingMethodId: "shipping-method-shipnow",
          providerCode: ShippingProviderCode.SHIPNOW,
          serviceName: "ShipNow",
          unavailableReason: "Completá ciudad en Mi Negocio para usar ShipNow.",
        },
      ],
    });
    expect(shipnowGetRates).not.toHaveBeenCalled();
  });

  it("derives the canonical kind from the provider code on create", async () => {
    const service = new ShippingService();

    const result = await service.createMethod("tenant-1", {
      name: "Envío con ShipNow",
      kind: ShippingMethodKind.PICKUP,
      providerCode: ShippingProviderCode.SHIPNOW,
    });

    expect(shippingMethodCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: ShippingMethodKind.THIRD_PARTY,
          providerCode: ShippingProviderCode.SHIPNOW,
        }),
      })
    );
    expect(result.status).toBe(201);
  });

  it("rejects a home delivery checkout when the address changed after quoting", async () => {
    const orderShipmentCreate = vi.fn();
    const tx = {
      shippingMethod: {
        findFirst: vi.fn().mockResolvedValue({
          id: "shipping-method-1",
          tenantId: "tenant-1",
          name: "Moto mandados",
          kind: ShippingMethodKind.EXTERNAL,
          providerCode: ShippingProviderCode.CUSTOM_EXTERNAL,
          isActive: true,
          availableInCheckout: true,
          availableInAdmin: true,
          displayOrder: 0,
          config: null,
          zoneRules: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      shipmentQuote: {
        findFirst: vi.fn().mockResolvedValue({
          id: "quote-1",
          tenantId: "tenant-1",
          shippingMethodId: "shipping-method-1",
          quoteType: ShippingQuoteType.HOME_DELIVERY,
          serviceCode: "external-fixed-rate",
          serviceName: "Moto mandados",
          price: 1500,
          currency: "ARS",
          destination: {
            recipientName: "Carlos Test",
            recipientPhone: "3871234567",
            streetName: "Belgrano",
            streetNumber: "123",
            postalCode: "4400",
            city: "Salta",
            province: "Salta",
            country: "Argentina",
          },
          providerPayload: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      businessData: {
        findUnique: vi.fn().mockResolvedValue({
          address: "Belgrano 123",
          province: "Salta",
          businessHours: "9 a 18",
        }),
      },
      orderShipment: {
        create: orderShipmentCreate,
      },
    };

    const service = new ShippingService();

    await expect(
      service.attachShipmentToOrder(tx as never, {
        tenantId: "tenant-1",
        orderId: "order-1",
        items: [
          {
            productId: "product-1",
            quantity: 1,
            product: {
              id: "product-1",
              name: "Producto test",
              price: 1000,
              stock: 10,
              weightGrams: 500,
              lengthCm: 10,
              widthCm: 10,
              heightCm: 10,
            },
          },
        ],
        selection: {
          shippingMethodId: "shipping-method-1",
          shippingQuoteId: "quote-1",
          shippingSelectionType: ShippingQuoteType.HOME_DELIVERY,
          shippingAddress: {
            recipientName: "Carlos Test",
            recipientPhone: "3871234567",
            streetName: "Belgrano",
            streetNumber: "456",
            postalCode: "4400",
            city: "Salta",
            province: "Salta",
            country: "Argentina",
          },
        },
      })
    ).rejects.toMatchObject({
      message: "La dirección cambió después de cotizar. Volvé a cotizar el envío.",
    });

    expect(orderShipmentCreate).not.toHaveBeenCalled();
  });
});
