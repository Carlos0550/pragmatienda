import { PaymentProvider, UserStatus } from "@prisma/client";
import type { z } from "zod";
import { hashString } from "../../config/security";
import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import { sendMail } from "../../mail/mailer";
import {
  buildNewOrderAdminHtml,
  buildOrderConfirmationBuyerHtml,
  buildWelcomeUserEmailHtml,
  type OrderItemForEmail
} from "../../utils/template.utils";
import { issueGuestCartToken } from "../../utils/guest-cart.utils";
import { generateSecureString } from "../../utils/security.utils";
import type { deleteCartItemsSchema, guestCheckoutDetailsSchema, patchCartItemsSchema, checkoutOriginSchema } from "./cart.zod";
import {
  CheckoutError,
  clearCart,
  createOrder,
  createOrderItemsForOrder,
  createOrderItemsWithoutOrder,
  createSalesForOrder,
  createSalesForOrderItems,
  decimalToNumber,
  uploadProofImage,
  validateAndReserveStock,
  type CartForCheckout,
  type PrismaTransactionClient
} from "./checkout.helpers";

type ServiceResponse = {
  status: number;
  message: string;
  data?: unknown;
  err?: string;
  guestCartToken?: string;
  clearGuestCart?: boolean;
};

type CartActorInput = {
  userId?: string | null;
  guestCartToken?: string | null;
  tenantId: string;
};

type GuestCheckoutInput = z.infer<typeof guestCheckoutDetailsSchema>;

type CheckoutInput = CartActorInput & {
  file: Express.Multer.File | null;
  paymentProvider: PaymentProvider;
  origin: z.infer<typeof checkoutOriginSchema>;
  guestDetails?: GuestCheckoutInput;
};

const cartItemSelect = {
  id: true,
  productId: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      image: true,
      stock: true
    }
  }
} as const;

const cartSelect = {
  id: true,
  items: {
    select: cartItemSelect
  }
} as const;

const checkoutCartSelect = {
  id: true,
  items: {
    select: {
      productId: true,
      quantity: true,
      product: {
        select: { id: true, name: true, price: true, stock: true }
      }
    }
  }
} as const;

const trimGuestString = (value?: string | null) => value?.trim() ?? "";

export class CartService {
  private async findGuestCart(
    tenantId: string,
    token?: string | null,
    select: typeof cartSelect | typeof checkoutCartSelect = cartSelect
  ) {
    if (!token) return null;
    return prisma.guestCart.findUnique({
      where: { tenantId_token: { tenantId, token } },
      select
    });
  }

  private async findUserCart(
    tenantId: string,
    userId: string,
    select: typeof cartSelect | typeof checkoutCartSelect = cartSelect
  ) {
    return prisma.cart.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select
    });
  }

  private async getOrCreateGuestCart(
    tenantId: string,
    token?: string | null
  ) {
    const effectiveToken = token?.trim() || issueGuestCartToken();
    let guestCart = await prisma.guestCart.findUnique({
      where: { tenantId_token: { tenantId, token: effectiveToken } },
      select: { id: true }
    });

    if (!guestCart) {
      guestCart = await prisma.guestCart.create({
        data: { tenantId, token: effectiveToken },
        select: { id: true }
      });
    }

    return { guestCart, token: effectiveToken };
  }

  private async resolveCheckoutCustomer(
    tenantId: string,
    guestDetails?: GuestCheckoutInput
  ) {
    const guestName = trimGuestString(guestDetails?.name);
    const guestEmail = trimGuestString(guestDetails?.email).toLowerCase();
    const guestPhone = trimGuestString(guestDetails?.phone);

    if (!guestName || !guestEmail || !guestPhone) {
      throw new CheckoutError(400, "Nombre, email y teléfono son obligatorios para finalizar la compra.");
    }

    if (!guestDetails?.createAccountAfterPurchase) {
      return {
        userId: null,
        guestName,
        guestEmail,
        guestPhone,
        newCheckoutUserData: null as {
          name: string;
          email: string;
          phone: string;
          password: string;
        } | null
      };
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        tenantId,
        email: guestEmail,
        role: 2
      },
      select: { id: true }
    });

    if (existingUser) {
      return {
        userId: existingUser.id,
        guestName: null,
        guestEmail: null,
        guestPhone: null,
        newCheckoutUserData: null as {
          name: string;
          email: string;
          phone: string;
          password: string;
        } | null
      };
    }

    return {
      userId: null,
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      newCheckoutUserData: {
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
        password: await hashString(generateSecureString())
      }
    };
  }

  private async sendOrderEmails(orderId: string) {
    const orderWithDetails = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            product: {
              select: { name: true, image: true }
            }
          }
        },
        user: {
          select: { email: true, name: true }
        },
        tenant: {
          select: {
            businessData: { select: { name: true } },
            owner: { select: { email: true } },
            users: {
              where: { role: 1 },
              select: { email: true }
            }
          }
        }
      }
    });

    if (!orderWithDetails) return;

    const buyerEmail = orderWithDetails.user?.email ?? orderWithDetails.guestEmail ?? "";
    const buyerName =
      orderWithDetails.user?.name ??
      orderWithDetails.guestName ??
      orderWithDetails.user?.email ??
      orderWithDetails.guestEmail ??
      "Cliente";

    if (!buyerEmail) return;

    const itemsForEmail: OrderItemForEmail[] = orderWithDetails.items.map((item) => {
      const itemSubtotal = decimalToNumber(item.unitPrice) * item.quantity;
      return {
        productName: item.product.name,
        productImageUrl: item.product.image ?? "",
        quantity: item.quantity,
        subtotal: itemSubtotal.toFixed(2)
      };
    });

    const totalAmount = itemsForEmail
      .reduce((sum, item) => sum + parseFloat(item.subtotal), 0)
      .toFixed(2);
    const businessName = orderWithDetails.tenant.businessData?.name ?? "Tienda";

    const buyerHtml = await buildOrderConfirmationBuyerHtml({
      buyerName,
      orderId: orderWithDetails.id,
      items: itemsForEmail,
      total: totalAmount,
      businessName
    });

    const adminEmails = new Set<string>();
    if (orderWithDetails.tenant.owner?.email) {
      adminEmails.add(orderWithDetails.tenant.owner.email);
    }
    for (const user of orderWithDetails.tenant.users) {
      if (user.email) adminEmails.add(user.email);
    }

    try {
      await sendMail({
        to: buyerEmail,
        subject: `Confirmación de compra - ${businessName}`,
        html: buyerHtml
      });
    } catch (mailErr) {
      logger.error("Error al enviar email al comprador:", (mailErr as Error).message);
    }

    if (adminEmails.size === 0) return;

    const adminHtml = await buildNewOrderAdminHtml({
      buyerName,
      buyerEmail,
      orderId: orderWithDetails.id,
      total: totalAmount,
      businessName
    });

    try {
      await sendMail({
        to: Array.from(adminEmails),
        subject: `Nueva orden #${orderWithDetails.id.slice(-8)} - ${businessName}`,
        html: adminHtml
      });
    } catch (mailErr) {
      logger.error("Error al enviar email a admins:", (mailErr as Error).message);
    }
  }

  private async sendCheckoutAccountWelcomeEmail(
    tenantId: string,
    createdUser: { id: string; email: string; name: string | null } | null
  ) {
    if (!createdUser) return;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessData: true }
    });

    if (!tenant?.businessData) return;

    const html = await buildWelcomeUserEmailHtml({
      user: {
        ...createdUser,
        tenantId
      },
      business: tenant.businessData
    });

    try {
      await sendMail({
        to: createdUser.email,
        subject: "Bienvenido a PragmaTienda",
        html
      });
    } catch (mailErr) {
      logger.error("Error al enviar email de bienvenida desde checkout:", (mailErr as Error).message);
    }
  }

  async getCart(input: CartActorInput): Promise<ServiceResponse> {
    try {
      if (input.userId) {
        const cart = await this.findUserCart(input.tenantId, input.userId, cartSelect);
        return { status: 200, message: "Carrito obtenido.", data: cart ?? { items: [] } };
      }

      if (!input.guestCartToken) {
        return { status: 200, message: "Carrito obtenido.", data: { items: [] } };
      }

      const cart = await this.findGuestCart(input.tenantId, input.guestCartToken, cartSelect);
      if (!cart) {
        return {
          status: 200,
          message: "Carrito obtenido.",
          data: { items: [] },
          clearGuestCart: true
        };
      }

      return { status: 200, message: "Carrito obtenido.", data: cart };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getCart:", err.message);
      return { status: 500, message: "Error al obtener el carrito.", err: err.message };
    }
  }

  async deleteItems(
    input: CartActorInput,
    data: z.infer<typeof deleteCartItemsSchema>
  ): Promise<ServiceResponse> {
    try {
      const cart = input.userId
        ? await this.findUserCart(input.tenantId, input.userId, cartSelect)
        : await this.findGuestCart(input.tenantId, input.guestCartToken, cartSelect);

      if (!cart) {
        return {
          status: 200,
          message: "Carrito vaciado.",
          ...(input.userId ? {} : { clearGuestCart: Boolean(input.guestCartToken) })
        };
      }

      const productIds = data.productIds;
      if (productIds && productIds.length > 0) {
        const cartProductIds = new Set(cart.items.map((item) => item.productId));
        const invalidIds = productIds.filter((id) => !cartProductIds.has(id));
        if (invalidIds.length > 0) {
          return {
            status: 400,
            message: "Algunos productos no están en el carrito.",
            err: `productIds no encontrados: ${invalidIds.join(", ")}`
          };
        }
      }

      if (input.userId) {
        await prisma.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            ...(productIds?.length ? { productId: { in: productIds } } : {})
          }
        });
      } else {
        await prisma.guestCartItem.deleteMany({
          where: {
            guestCartId: cart.id,
            ...(productIds?.length ? { productId: { in: productIds } } : {})
          }
        });
      }

      const remainingCount = input.userId
        ? await prisma.cartItem.count({ where: { cartId: cart.id } })
        : await prisma.guestCartItem.count({ where: { guestCartId: cart.id } });

      if (!input.userId && remainingCount === 0) {
        await prisma.guestCart.delete({ where: { id: cart.id } }).catch(() => undefined);
      }

      return {
        status: 200,
        message: "Items eliminados del carrito.",
        ...(input.userId ? {} : { clearGuestCart: remainingCount === 0 })
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en deleteItems:", err.message);
      return { status: 500, message: "Error al eliminar items.", err: err.message };
    }
  }

  async patchItems(
    input: CartActorInput,
    data: z.infer<typeof patchCartItemsSchema>
  ): Promise<ServiceResponse> {
    try {
      const { productId, delta } = data;
      const product = await prisma.products.findFirst({
        where: { id: productId, tenantId: input.tenantId },
        select: { id: true, stock: true }
      });

      if (!product) {
        return { status: 404, message: "Producto no encontrado." };
      }

      if (input.userId) {
        let cart = await prisma.cart.findUnique({
          where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
          select: { id: true, items: { where: { productId }, select: { id: true, quantity: true } } }
        });

        if (!cart) {
          cart = await prisma.cart.create({
            data: { userId: input.userId, tenantId: input.tenantId },
            select: { id: true, items: { where: { productId }, select: { id: true, quantity: true } } }
          });
        }

        const existingItem = cart.items[0];
        if (existingItem) {
          const newQuantity = existingItem.quantity + delta;
          if (newQuantity <= 0) {
            await prisma.cartItem.delete({ where: { id: existingItem.id } });
            return { status: 200, message: "Item eliminado del carrito.", data: { quantity: 0 } };
          }
          if (delta > 0 && newQuantity > product.stock) {
            return { status: 400, message: `Stock insuficiente. Disponible: ${product.stock}.` };
          }
          const updated = await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
            select: { id: true, quantity: true, productId: true }
          });
          return { status: 200, message: "Cantidad actualizada.", data: updated };
        }

        if (delta <= 0) {
          return { status: 400, message: "El producto no está en el carrito. Use delta positivo para agregar." };
        }
        if (delta > product.stock) {
          return { status: 400, message: `Stock insuficiente. Disponible: ${product.stock}.` };
        }

        const created = await prisma.cartItem.create({
          data: { cartId: cart.id, productId, quantity: delta },
          select: { id: true, quantity: true, productId: true }
        });
        return { status: 200, message: "Item agregado al carrito.", data: created };
      }

      const { guestCart, token } = await this.getOrCreateGuestCart(input.tenantId, input.guestCartToken);
      const existingItem = await prisma.guestCartItem.findUnique({
        where: { guestCartId_productId: { guestCartId: guestCart.id, productId } },
        select: { id: true, quantity: true }
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + delta;
        if (newQuantity <= 0) {
          await prisma.guestCartItem.delete({ where: { id: existingItem.id } });
          const remaining = await prisma.guestCartItem.count({ where: { guestCartId: guestCart.id } });
          if (remaining === 0) {
            await prisma.guestCart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
          }
          return {
            status: 200,
            message: "Item eliminado del carrito.",
            data: { quantity: 0 },
            guestCartToken: token,
            clearGuestCart: remaining === 0
          };
        }
        if (delta > 0 && newQuantity > product.stock) {
          return { status: 400, message: `Stock insuficiente. Disponible: ${product.stock}.` };
        }
        const updated = await prisma.guestCartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
          select: { id: true, quantity: true, productId: true }
        });
        return {
          status: 200,
          message: "Cantidad actualizada.",
          data: updated,
          guestCartToken: token
        };
      }

      if (delta <= 0) {
        return { status: 400, message: "El producto no está en el carrito. Use delta positivo para agregar." };
      }
      if (delta > product.stock) {
        return { status: 400, message: `Stock insuficiente. Disponible: ${product.stock}.` };
      }

      const created = await prisma.guestCartItem.create({
        data: { guestCartId: guestCart.id, productId, quantity: delta },
        select: { id: true, quantity: true, productId: true }
      });
      return {
        status: 200,
        message: "Item agregado al carrito.",
        data: created,
        guestCartToken: token
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en patchItems:", err.message);
      return { status: 500, message: "Error al actualizar el carrito.", err: err.message };
    }
  }

  async checkout(input: CheckoutInput): Promise<ServiceResponse> {
    try {
      let paymentProofImage: string | null = null;
      if (input.origin === "cart" && input.file) {
        paymentProofImage = await uploadProofImage(input.file, input.tenantId);
      }

      const guestCheckout = !input.userId
        ? await this.resolveCheckoutCustomer(input.tenantId, input.guestDetails)
        : null;

      const transactionResult = await prisma.$transaction(async (tx) => {
        const txClient = tx as unknown as PrismaTransactionClient;
        const cart = input.userId
          ? await tx.cart.findUnique({
              where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
              select: checkoutCartSelect
            })
          : input.guestCartToken
            ? await tx.guestCart.findUnique({
                where: { tenantId_token: { tenantId: input.tenantId, token: input.guestCartToken } },
                select: checkoutCartSelect
              })
            : null;

        if (!cart || cart.items.length === 0) {
          throw new CheckoutError(400, "El carrito debe tener al menos un producto para finalizar la orden.");
        }

        const cartForCheckout: CartForCheckout = cart;
        const subtotal = await validateAndReserveStock(txClient, input.tenantId, cartForCheckout);

        let checkoutUserId = input.userId ?? guestCheckout?.userId ?? null;
        let createdCheckoutUser: { id: string; email: string; name: string | null } | null = null;

        if (!input.userId && guestCheckout?.newCheckoutUserData) {
          const existingCheckoutUser = await tx.user.findFirst({
            where: {
              tenantId: input.tenantId,
              email: guestCheckout.newCheckoutUserData.email,
              role: 2
            },
            select: { id: true }
          });

          if (existingCheckoutUser) {
            checkoutUserId = existingCheckoutUser.id;
          } else {
            createdCheckoutUser = await tx.user.create({
              data: {
                name: guestCheckout.newCheckoutUserData.name,
                email: guestCheckout.newCheckoutUserData.email,
                phone: guestCheckout.newCheckoutUserData.phone,
                password: guestCheckout.newCheckoutUserData.password,
                role: 2,
                isVerified: false,
                status: UserStatus.PENDING,
                tenantId: input.tenantId
              },
              select: { id: true, email: true, name: true }
            });
            checkoutUserId = createdCheckoutUser.id;
          }
        }

        if (input.origin === "cart") {
          const order = await createOrder(txClient, {
            tenantId: input.tenantId,
            userId: checkoutUserId,
            guestName: guestCheckout?.guestName ?? null,
            guestEmail: guestCheckout?.guestEmail ?? null,
            guestPhone: guestCheckout?.guestPhone ?? null
          });
          await createOrderItemsForOrder(txClient, order.id, cart.items);
          await createSalesForOrder(txClient, {
            orderId: order.id,
            tenantId: input.tenantId,
            total: subtotal,
            paymentProvider: input.paymentProvider,
            paymentProofImage
          });

          if (input.userId) {
            await clearCart(txClient, cart.id);
          } else {
            await tx.guestCartItem.deleteMany({ where: { guestCartId: cart.id } });
            await tx.guestCart.delete({ where: { id: cart.id } });
          }

          return {
            orderId: order.id,
            createdCheckoutUser
          } as const;
        }

        const orderItems = await createOrderItemsWithoutOrder(txClient, cart.items);
        const saleIds = await createSalesForOrderItems(txClient, input.tenantId, orderItems, input.paymentProvider);
        await clearCart(txClient, cart.id);
        return { saleIds } as const;
      });

      if ("orderId" in transactionResult) {
        const orderId = transactionResult.orderId as string;
        const createdCheckoutUser = transactionResult.createdCheckoutUser ?? null;
        setImmediate(async () => {
          await this.sendOrderEmails(orderId);
          await this.sendCheckoutAccountWelcomeEmail(input.tenantId, createdCheckoutUser);
        });

        return {
          status: 200,
          message: "Orden finalizada correctamente.",
          data: { order: orderId },
          clearGuestCart: !input.userId
        };
      }

      return {
        status: 200,
        message: "Venta registrada correctamente.",
        data: { saleIds: transactionResult.saleIds }
      };
    } catch (error) {
      if (error instanceof CheckoutError) {
        return { status: error.status, message: error.message };
      }
      const err = error as Error;
      logger.error("Error en checkout:", err.message);
      return { status: 500, message: "Error al procesar el checkout.", err: err.message };
    }
  }

  async mergeGuestCartToUser(
    tenantId: string,
    userId: string,
    guestCartToken?: string | null
  ) {
    if (!guestCartToken) {
      return { merged: false, clearGuestCart: false };
    }

    const guestCart = await prisma.guestCart.findUnique({
      where: { tenantId_token: { tenantId, token: guestCartToken } },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            product: {
              select: { stock: true }
            }
          }
        }
      }
    });

    if (!guestCart) {
      return { merged: false, clearGuestCart: true };
    }

    await prisma.$transaction(async (tx) => {
      let userCart = await tx.cart.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        include: { items: { select: { id: true, productId: true, quantity: true } } }
      });

      if (!userCart) {
        userCart = await tx.cart.create({
          data: { tenantId, userId },
          include: { items: { select: { id: true, productId: true, quantity: true } } }
        });
      }

      const existingItems = new Map(userCart.items.map((item) => [item.productId, item]));

      for (const guestItem of guestCart.items) {
        const existing = existingItems.get(guestItem.productId);
        const desiredQuantity = (existing?.quantity ?? 0) + guestItem.quantity;
        const finalQuantity = Math.min(desiredQuantity, guestItem.product.stock);

        if (existing) {
          if (finalQuantity <= 0) {
            await tx.cartItem.delete({ where: { id: existing.id } }).catch(() => undefined);
          } else {
            await tx.cartItem.update({
              where: { id: existing.id },
              data: { quantity: finalQuantity }
            });
          }
          continue;
        }

        if (finalQuantity <= 0) {
          continue;
        }

        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: guestItem.productId,
            quantity: finalQuantity
          }
        });
      }

      await tx.guestCartItem.deleteMany({ where: { guestCartId: guestCart.id } });
      await tx.guestCart.delete({ where: { id: guestCart.id } });
    });

    return { merged: true, clearGuestCart: true };
  }
}

export const cartService = new CartService();
