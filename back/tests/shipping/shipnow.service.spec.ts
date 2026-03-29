import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggerError, loggerInfo, loggerWarn } = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("../../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    SHIPNOW_API_TOKEN: "test-shipnow-token",
  },
}));

vi.mock("../../src/config/logger", () => ({
  logger: {
    error: loggerError,
    info: loggerInfo,
    warn: loggerWarn,
  },
}));

import { shipnowService } from "../../src/services/Shipping/shipnow.service";

describe("shipnowService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("consulta shipping_options y mapea la respuesta al formato interno", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            minimum_delivery: "2026-03-31T09:00:00.000Z",
            maximum_delivery: "2026-04-01T18:00:00.000Z",
            price: 1000,
            tax_price: 1210,
            shipping_contract: {
              id: 55,
              status: "active",
            },
            shipping_service: {
              id: 10,
              code: "shipnow-economic-home",
              description: "Envío estándar a domicilio",
              type: "ship_pap",
              mode: "delivery",
              category: "economic",
              carrier: {
                code: "correo-test",
                description: "Correo Test",
                flexible_dispatching: false,
                id: 3,
                image_url: null,
                name: "Correo Test",
                tracking_url: "https://tracking.test/{tracking_code}",
              },
            },
          },
        ],
      }),
    });

    const rates = await shipnowService.getRates(
      {
        name: "Negocio test",
        street: "Belgrano",
        number: "123",
        city: "Salta",
        province: "Salta",
        postal_code: "4400",
        phone: "3871234567",
      },
      {
        name: "Carlos Test",
        street: "Tarelli",
        number: "233",
        city: "Candelaria",
        province: "Misiones",
        postal_code: "3308",
        phone: "3871234567",
      },
      {
        totalWeightGrams: 1500,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
        itemCount: 1,
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.shipnow.com.ar/shipping_options?weight=1500&to_zip_code=3308&mode=delivery&categories=economic&types=ship_pap",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer test-shipnow-token",
        }),
      })
    );

    expect(rates).toEqual([
      {
        id: "shipnow-economic-home",
        carrier: "Correo Test",
        service: "Envío estándar a domicilio",
        service_code: "shipnow-economic-home",
        price: 1210,
        currency: "ARS",
        estimated_delivery: "2026-03-31T09:00:00.000Z",
        tracking_available: true,
      },
    ]);
  });

  it("omite opciones incompletas de shipping_options", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            minimum_delivery: "2026-03-31T09:00:00.000Z",
            price: 1000,
            shipping_service: {
              id: 10,
              code: "",
              description: "Envío estándar a domicilio",
              type: "ship_pap",
              mode: "delivery",
              category: "economic",
              carrier: {
                code: "correo-test",
                description: "Correo Test",
                flexible_dispatching: false,
                id: 3,
                image_url: null,
                name: "Correo Test",
                tracking_url: "",
              },
            },
          },
        ],
      }),
    });

    const rates = await shipnowService.getRates(
      {
        name: "Negocio test",
        street: "Belgrano",
        number: "123",
        city: "Salta",
        province: "Salta",
        postal_code: "4400",
        phone: "3871234567",
      },
      {
        name: "Carlos Test",
        street: "Tarelli",
        number: "233",
        city: "Candelaria",
        province: "Misiones",
        postal_code: "3308",
        phone: "3871234567",
      },
      {
        totalWeightGrams: 1500,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
        itemCount: 1,
      }
    );

    expect(rates).toEqual([]);
    expect(loggerWarn).toHaveBeenCalledWith(
      "Opción de ShipNow omitida por respuesta incompleta",
      expect.any(Object)
    );
  });
});
