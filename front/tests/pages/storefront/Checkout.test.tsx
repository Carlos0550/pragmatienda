import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CheckoutPage from "@/pages/storefront/Checkout";
import { withRouter } from "../../utils/test-utils";

const { mockCheckout, mockShippingQuote, cartState, authState, tenantState } = vi.hoisted(() => ({
  mockCheckout: vi.fn(),
  mockShippingQuote: vi.fn(),
  cartState: {
    cart: null as null | {
      id: string;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        product: {
          id: string;
          name: string;
          price: number;
          stock: number;
        };
      }>;
    },
    totalCart: 0,
  },
  authState: {
    user: null as null | {
      id: string;
      name: string;
      email: string;
      type: "customer";
      phone?: string;
    },
  },
  tenantState: {
    tenant: {
      bankOptions: [],
    } as { bankOptions: Array<unknown> },
  },
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => ({
    cart: cartState.cart,
    checkout: mockCheckout,
    totalCart: cartState.totalCart,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => tenantState,
}));

vi.mock("@/services/http", () => ({
  http: {
    shipping: {
      quote: mockShippingQuote,
    },
  },
}));

vi.mock("sileo", () => ({
  sileo: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("CheckoutPage", () => {
  beforeEach(() => {
    mockCheckout.mockReset();
    mockShippingQuote.mockReset();
    authState.user = null;
    tenantState.tenant = { bankOptions: [] };
    cartState.totalCart = 1500;
    cartState.cart = {
      id: "cart-1",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          quantity: 1,
          product: {
            id: "prod-1",
            name: "Producto Test",
            price: 1500,
            stock: 10,
          },
        },
      ],
    };
    mockShippingQuote.mockResolvedValue({
      items: [
        {
          id: "pickup-1",
          shippingMethodId: "shipping-pickup-1",
          providerCode: "LOCAL_PICKUP",
          kind: "PICKUP",
          price: 0,
          currency: "ARS",
          methodName: "Retiro Sucursal Centro",
        },
      ],
    });
  });

  it("clears pickup quotes when switching to home delivery until the user requests a new quote", async () => {
    render(withRouter(<CheckoutPage />));

    await waitFor(() => {
      expect(mockShippingQuote).toHaveBeenCalledWith({ quoteType: "PICKUP" });
    });

    expect(await screen.findByText("Retiro Sucursal Centro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Envío a domicilio/i }));

    await waitFor(() => {
      expect(screen.queryByText("Retiro Sucursal Centro")).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Cotizar envíos/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Completá la dirección y cotizá para ver opciones disponibles/i)
    ).toBeInTheDocument();
  });

  it("clears home delivery quotes when the address changes after quoting", async () => {
    mockShippingQuote.mockImplementation(async ({ quoteType }: { quoteType: "PICKUP" | "HOME_DELIVERY" }) => {
      if (quoteType === "PICKUP") {
        return {
          items: [
            {
              id: "pickup-1",
              shippingMethodId: "shipping-pickup-1",
              providerCode: "LOCAL_PICKUP",
              kind: "PICKUP",
              price: 0,
              currency: "ARS",
              methodName: "Retiro Sucursal Centro",
            },
          ],
        };
      }

      return {
        items: [
          {
            id: "delivery-1",
            shippingMethodId: "shipping-delivery-1",
            providerCode: "CUSTOM_EXTERNAL",
            kind: "EXTERNAL",
            quoteType: "HOME_DELIVERY",
            serviceName: "Envío express",
            price: 2500,
            currency: "ARS",
            methodName: "Moto mandados",
          },
        ],
      };
    });

    render(withRouter(<CheckoutPage />));

    await waitFor(() => {
      expect(mockShippingQuote).toHaveBeenCalledWith({ quoteType: "PICKUP" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Envío a domicilio/i }));
    const deliveryPanel = screen.getByRole("button", { name: /Cotizar envíos/i }).closest("div");
    expect(deliveryPanel).not.toBeNull();

    const getInputByLabel = (label: string) => {
      const container = within(deliveryPanel as HTMLElement).getByText(label).parentElement;
      const input = container?.querySelector("input");
      expect(input).not.toBeNull();
      return input as HTMLInputElement;
    };

    fireEvent.change(getInputByLabel("Destinatario"), { target: { value: "Carlos Test" } });
    fireEvent.change(getInputByLabel("Teléfono"), { target: { value: "3871234567" } });
    fireEvent.change(getInputByLabel("Código postal"), { target: { value: "4400" } });
    fireEvent.change(getInputByLabel("Calle"), { target: { value: "Belgrano" } });
    fireEvent.change(getInputByLabel("Número"), { target: { value: "123" } });
    fireEvent.change(getInputByLabel("Ciudad"), { target: { value: "Salta" } });
    fireEvent.change(getInputByLabel("Provincia"), { target: { value: "Salta" } });

    fireEvent.click(screen.getByRole("button", { name: /Cotizar envíos/i }));

    expect(await screen.findByText("Moto mandados")).toBeInTheDocument();

    fireEvent.change(getInputByLabel("Número"), { target: { value: "456" } });

    await waitFor(() => {
      expect(screen.queryByText("Moto mandados")).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(/Completá la dirección y cotizá para ver opciones disponibles/i)
    ).toBeInTheDocument();
  });

  it("shows unavailable shipping options without rendering a misleading zero price", async () => {
    mockShippingQuote.mockResolvedValueOnce({
      items: [
        {
          id: "pickup-1",
          shippingMethodId: "shipping-pickup-1",
          providerCode: "LOCAL_PICKUP",
          kind: "PICKUP",
          price: 0,
          currency: "ARS",
          methodName: "Retiro Sucursal Centro",
        },
      ],
    });

    mockShippingQuote.mockResolvedValueOnce({
      items: [
        {
          shippingMethodId: "shipping-shipnow-1",
          providerCode: "SHIPNOW",
          kind: "THIRD_PARTY",
          serviceName: "ShipNow",
          methodName: "Envío con ShipNow",
          unavailableReason: "Completá calle, número, ciudad y código postal en Mi Negocio para usar ShipNow.",
        },
      ],
    });

    render(withRouter(<CheckoutPage />));

    await waitFor(() => {
      expect(mockShippingQuote).toHaveBeenCalledWith({ quoteType: "PICKUP" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Envío a domicilio/i }));
    const deliveryPanel = screen.getByRole("button", { name: /Cotizar envíos/i }).closest("div");
    expect(deliveryPanel).not.toBeNull();

    const getInputByLabel = (label: string) => {
      const container = within(deliveryPanel as HTMLElement).getByText(label).parentElement;
      const input = container?.querySelector("input");
      expect(input).not.toBeNull();
      return input as HTMLInputElement;
    };

    fireEvent.change(getInputByLabel("Destinatario"), { target: { value: "Carlos Test" } });
    fireEvent.change(getInputByLabel("Teléfono"), { target: { value: "3871234567" } });
    fireEvent.change(getInputByLabel("Código postal"), { target: { value: "3308" } });
    fireEvent.change(getInputByLabel("Calle"), { target: { value: "Tarelli" } });
    fireEvent.change(getInputByLabel("Número"), { target: { value: "233" } });
    fireEvent.change(getInputByLabel("Ciudad"), { target: { value: "Candelaria" } });
    fireEvent.change(getInputByLabel("Provincia"), { target: { value: "Misiones" } });

    fireEvent.click(screen.getByRole("button", { name: /Cotizar envíos/i }));

    expect(await screen.findByText("Envío con ShipNow")).toBeInTheDocument();
    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/Completá calle, número, ciudad y código postal en Mi Negocio para usar ShipNow/i)
    ).toBeInTheDocument();
  });
});
