import type { PrismaClient } from "@prisma/client";
import { PaymentProvider, PaymentStatus } from "@prisma/client";
import { uploadPrivateObject } from "../../storage/minio";
import { generateSecureString } from "../../utils/security.utils";

/** Cliente de Prisma tal como se recibe dentro de $transaction (sin $connect, $transaction, etc.). */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export class CheckoutError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const decimalToNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof (value as { toString: () => string }).toString === "function"
  ) {
    return Number((value as { toString: () => string }).toString());
  }
  return Number(value ?? 0);
};

export type CartForCheckout = {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    product: { id: string; name: string; price: unknown; stock: number };
  }>;
};

export async function uploadProofImage(
  file: Express.Multer.File,
  tenantId: string
): Promise<string> {
  const objectName = `comprobantes/${tenantId}/${Date.now()}_${generateSecureString()}.webp`;
  await uploadPrivateObject({
    objectName,
    buffer: file.buffer as Buffer,
    contentType: file.mimetype
  });
  return objectName;
}

export async function validateAndReserveStock(
  tx: PrismaTransactionClient,
  tenantId: string,
  cart: CartForCheckout
): Promise<number> {
  let subtotal = 0;
  for (const item of cart.items) {
    if (item.quantity <= 0) {
      throw new CheckoutError(400, "Cantidad de producto invalida para checkout.");
    }
    const updated = await tx.products.updateMany({
      where: {
        id: item.productId,
        tenantId,
        stock: { gte: item.quantity }
      },
      data: { stock: { decrement: item.quantity } }
    });
    if (updated.count !== 1) {
      throw new CheckoutError(
        409,
        `Stock insuficiente para "${item.product.name}".`
      );
    }
    subtotal += decimalToNumber(item.product.price) * item.quantity;
  }
  return subtotal;
}

export async function createOrder(
  tx: PrismaTransactionClient,
  input: {
    tenantId: string;
    userId?: string | null;
    guestName?: string | null;
    guestEmail?: string | null;
    guestPhone?: string | null;
  }
): Promise<{ id: string }> {
  const order = await tx.order.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      guestName: input.guestName ?? null,
      guestEmail: input.guestEmail ?? null,
      guestPhone: input.guestPhone ?? null
    },
    select: { id: true }
  });
  return order;
}

export async function createOrderItemsForOrder(
  tx: PrismaTransactionClient,
  orderId: string,
  items: CartForCheckout["items"]
): Promise<void> {
  await tx.orderItem.createMany({
    data: items.map((item) => ({
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.product.price)
    }))
  });
}

export type OrderItemCreated = {
  id: string;
  quantity: number;
  unitPrice: unknown;
};

export async function createOrderItemsWithoutOrder(
  tx: PrismaTransactionClient,
  items: CartForCheckout["items"]
): Promise<OrderItemCreated[]> {
  const created: OrderItemCreated[] = [];
  for (const item of items) {
    const row = await tx.orderItem.create({
      data: {
        orderId: null,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: decimalToNumber(item.product.price)
      },
      select: { id: true, quantity: true, unitPrice: true }
    });
    created.push(row as OrderItemCreated);
  }
  return created;
}

export async function createSalesForOrder(
  tx: PrismaTransactionClient,
  payload: {
    orderId: string;
    tenantId: string;
    total: number;
    paymentProvider: PaymentProvider;
    paymentProofImage: string | null;
  }
): Promise<void> {
  await tx.sales.create({
    data: {
      orderId: payload.orderId,
      tenantId: payload.tenantId,
      total: payload.total,
      paymentProvider: payload.paymentProvider,
      paymentProofImage: payload.paymentProofImage ?? undefined,
      status: PaymentStatus.PAID
    }
  });
}

export async function createSalesForOrderItems(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderItems: OrderItemCreated[],
  paymentProvider: PaymentProvider
): Promise<string[]> {
  const saleIds: string[] = [];
  for (const item of orderItems) {
    const total = decimalToNumber(item.unitPrice) * item.quantity;
    const sale = await tx.sales.create({
      data: {
        orderItemId: item.id,
        tenantId,
        total,
        paymentProvider,
        paymentProofImage: null,
        status: PaymentStatus.PAID
      },
      select: { id: true }
    });
    saleIds.push(sale.id);
  }
  return saleIds;
}

export async function clearCart(tx: PrismaTransactionClient, cartId: string): Promise<void> {
  await tx.cartItem.deleteMany({ where: { cartId } });
}
