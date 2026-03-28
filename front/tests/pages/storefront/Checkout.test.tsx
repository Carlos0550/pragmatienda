import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
