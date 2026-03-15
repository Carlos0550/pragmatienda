import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  productsFindFirst,
  cartFindUnique,
  cartCreate,
  cartItemDelete,
  cartItemUpdate,
  cartItemCreate,
  guestCartFindUnique,
  guestCartCreate,
  guestCartDelete,
  guestCartItemFindUnique,
  guestCartItemDelete,
  guestCartItemCount,
  guestCartItemUpdate,
  guestCartItemCreate,
  loggerError,
  issueGuestCartToken
} = vi.hoisted(() => ({
  productsFindFirst: vi.fn(),
  cartFindUnique: vi.fn(),
  cartCreate: vi.fn(),
  cartItemDelete: vi.fn(),
  cartItemUpdate: vi.fn(),
  cartItemCreate: vi.fn(),
  guestCartFindUnique: vi.fn(),
  guestCartCreate: vi.fn(),
  guestCartDelete: vi.fn(),
  guestCartItemFindUnique: vi.fn(),
  guestCartItemDelete: vi.fn(),
  guestCartItemCount: vi.fn(),
  guestCartItemUpdate: vi.fn(),
  guestCartItemCreate: vi.fn(),
  loggerError: vi.fn(),
  issueGuestCartToken: vi.fn(() => "guest-token")
}));

vi.mock("../../src/db/prisma", () => ({
  prisma: {
    products: { findFirst: productsFindFirst },
    cart: { findUnique: cartFindUnique, create: cartCreate },
    cartItem: { delete: cartItemDelete, update: cartItemUpdate, create: cartItemCreate },
    guestCart: { findUnique: guestCartFindUnique, create: guestCartCreate, delete: guestCartDelete },
    guestCartItem: {
      findUnique: guestCartItemFindUnique,
      delete: guestCartItemDelete,
      count: guestCartItemCount,
      update: guestCartItemUpdate,
      create: guestCartItemCreate
    }
  }
}));

vi.mock("../../src/config/logger", () => ({
  logger: {
    error: loggerError
  }
}));

vi.mock("../../src/mail/mailer", () => ({
  sendMail: vi.fn()
}));

vi.mock("../../src/config/security", () => ({
  hashString: vi.fn(async () => "hashed-password")
}));

vi.mock("../../src/utils/template.utils", () => ({
  buildNewOrderAdminHtml: vi.fn(),
  buildOrderConfirmationBuyerHtml: vi.fn(),
  buildWelcomeUserEmailHtml: vi.fn()
}));

vi.mock("../../src/utils/guest-cart.utils", () => ({
  issueGuestCartToken
}));

vi.mock("../../src/utils/security.utils", () => ({
  generateSecureString: vi.fn(() => "secure-string")
}));

vi.mock("../../src/services/Cart/checkout.helpers", () => ({
  CheckoutError: class CheckoutError extends Error {},
  clearCart: vi.fn(),
  createOrder: vi.fn(),
  createOrderItemsForOrder: vi.fn(),
  createOrderItemsWithoutOrder: vi.fn(),
  createSalesForOrder: vi.fn(),
  createSalesForOrderItems: vi.fn(),
  decimalToNumber: vi.fn(),
  uploadProofImage: vi.fn(),
  validateAndReserveStock: vi.fn()
}));

import { CartService } from "../../src/services/Cart/cart.service";

describe("CartService.patchItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'Producto sin stock.' when the cart already has all available stock", async () => {
    productsFindFirst.mockResolvedValue({ id: "prod-1", stock: 2 });
    cartFindUnique.mockResolvedValue({
      id: "cart-1",
      items: [{ id: "item-1", quantity: 2 }]
    });

    const service = new CartService();
    const result = await service.patchItems(
      { tenantId: "tenant-1", userId: "user-1" },
      { productId: "prod-1", delta: 1 }
    );

    expect(result).toEqual({
      status: 400,
      message: "Producto sin stock."
    });
  });

  it("returns the remaining stock when an existing item exceeds the available quantity", async () => {
    productsFindFirst.mockResolvedValue({ id: "prod-1", stock: 5 });
    cartFindUnique.mockResolvedValue({
      id: "cart-1",
      items: [{ id: "item-1", quantity: 3 }]
    });

    const service = new CartService();
    const result = await service.patchItems(
      { tenantId: "tenant-1", userId: "user-1" },
      { productId: "prod-1", delta: 3 }
    );

    expect(result).toEqual({
      status: 400,
      message: "Stock insuficiente. Disponible: 2."
    });
  });

  it("returns 'Producto sin stock.' when creating a new guest cart item for a product with zero stock", async () => {
    productsFindFirst.mockResolvedValue({ id: "prod-1", stock: 0 });
    guestCartFindUnique.mockResolvedValue({ id: "guest-cart-1" });
    guestCartItemFindUnique.mockResolvedValue(null);

    const service = new CartService();
    const result = await service.patchItems(
      { tenantId: "tenant-1", guestCartToken: "guest-token" },
      { productId: "prod-1", delta: 1 }
    );

    expect(result).toEqual({
      status: 400,
      message: "Producto sin stock."
    });
  });
});
