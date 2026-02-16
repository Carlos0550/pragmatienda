import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import { sendMail } from "../../mail/mailer";
import { uploadPrivateObject } from "../../storage/minio";
import {
  buildNewOrderAdminHtml,
  buildOrderConfirmationBuyerHtml,
  type OrderItemForEmail
} from "../../utils/template.utils";
import { generateSecureString } from "../../utils/security.utils";
import type { z } from "zod";
import type { patchCartItemsSchema, deleteCartItemsSchema } from "./cart.zod";

type ServiceResponse = { status: number; message: string; data?: unknown; err?: string };

class CheckoutError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const decimalToNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return Number(value.toString());
  }
  return Number(value ?? 0);
};

export class CartService {
  async getCart(userId: string, tenantId: string): Promise<ServiceResponse> {
    try {
      const cart = await prisma.cart.findUnique({
        where: {
          tenantId_userId: { tenantId, userId }
        },
        select: {
          id: true,
          items: {
            select: {
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
            }
          }
        }
      });

      if (!cart) {
        return { status: 200, message: "Carrito obtenido.", data: { items: [] } };
      }

      return { status: 200, message: "Carrito obtenido.", data: cart };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getCart: ", err.message);
      return { status: 500, message: "Error al obtener el carrito.", err: err.message };
    }
  }

  async deleteItems(
    userId: string,
    tenantId: string,
    data: z.infer<typeof deleteCartItemsSchema>
  ): Promise<ServiceResponse> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { id: true, items: { select: { productId: true } } }
      });

      if (!cart) {
        return { status: 200, message: "Carrito vaciado." };
      }

      const productIds = data.productIds;
      if (productIds && productIds.length > 0) {
        const cartProductIds = new Set(cart.items.map((i) => i.productId));
        const invalidIds = productIds.filter((id) => !cartProductIds.has(id));
        if (invalidIds.length > 0) {
          return {
            status: 400,
            message: "Algunos productos no están en el carrito.",
            err: `productIds no encontrados: ${invalidIds.join(", ")}`
          };
        }
        await prisma.cartItem.deleteMany({
          where: { cartId: cart.id, productId: { in: productIds } }
        });
      } else {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return { status: 200, message: "Items eliminados del carrito." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en deleteItems: ", err.message);
      return { status: 500, message: "Error al eliminar items.", err: err.message };
    }
  }

  async patchItems(
    userId: string,
    tenantId: string,
    data: z.infer<typeof patchCartItemsSchema>
  ): Promise<ServiceResponse> {
    try {
      const { productId, delta } = data;

      const product = await prisma.products.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, stock: true }
      });

      if (!product) {
        return { status: 404, message: "Producto no encontrado." };
      }

      let cart = await prisma.cart.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { id: true, items: { where: { productId }, select: { id: true, quantity: true } } }
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId, tenantId },
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
          return {
            status: 400,
            message: `Stock insuficiente. Disponible: ${product.stock}.`
          };
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
        return {
          status: 400,
          message: `Stock insuficiente. Disponible: ${product.stock}.`
        };
      }

      const created = await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity: delta },
        select: { id: true, quantity: true, productId: true }
      });
      return { status: 200, message: "Item agregado al carrito.", data: created };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en patchItems: ", err.message);
      return { status: 500, message: "Error al actualizar el carrito.", err: err.message };
    }
  }

  async checkout(
    userId: string,
    tenantId: string,
    file: Express.Multer.File
  ): Promise<ServiceResponse> {
    try {
      const objectName = `comprobantes/${tenantId}/${Date.now()}_${generateSecureString()}.webp`;
      await uploadPrivateObject({
        objectName,
        buffer: file.buffer as Buffer,
        contentType: file.mimetype
      });

      const transaction = await prisma.$transaction(async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
          select: {
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
          }
        });

        if (!cart || cart.items.length === 0) {
          throw new CheckoutError(
            400,
            "El carrito debe tener al menos un item para finalizar la orden."
          );
        }

        let subtotal = 0;
        for (const item of cart.items) {
          if (!item.product) {
            throw new CheckoutError(404, `Producto no encontrado: ${item.productId}`);
          }
          if (item.quantity <= 0) {
            throw new CheckoutError(400, "Cantidad de item invalida para checkout.");
          }

          const updated = await tx.products.updateMany({
            where: {
              id: item.productId,
              tenantId,
              stock: {
                gte: item.quantity
              }
            },
            data: {
              stock: {
                decrement: item.quantity
              }
            }
          });

          if (updated.count !== 1) {
            throw new CheckoutError(
              409,
              `Stock insuficiente para "${item.product.name}".`
            );
          }

          subtotal += decimalToNumber(item.product.price) * item.quantity;
        }

        const order = await tx.order.create({
          data: {
            tenantId,
            userId,
            paymentProofImage: objectName,
            paymentProvider: "manual_upload",
            subtotal,
            total: subtotal,
            currency: "ARS"
          },
          select: { id: true }
        });

        await tx.orderItem.createMany({
          data: cart.items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price
          }))
        });

        await tx.cartItem.deleteMany({
          where: { cartId: cart.id }
        });

        return order.id;
      });

      const orderId = transaction;

      const orderWithDetails = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
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

      if (orderWithDetails) {
        setImmediate(async() => {
          const itemsForEmail: OrderItemForEmail[] = orderWithDetails.items.map((item) => {
            const price = item.unitPrice;
            const qty = item.quantity;
            const subtotal = decimalToNumber(price) * qty;
            return {
              productName: item.product.name,
              productImageUrl: item.product.image ?? "",
              quantity: qty,
              subtotal: subtotal.toFixed(2)
            };
          });
  
          const totalAmount = itemsForEmail.reduce((sum, i) => sum + parseFloat(i.subtotal), 0).toFixed(2);
          const businessName = orderWithDetails.tenant.businessData?.name ?? "Tienda";
  
          const buyerHtml = await buildOrderConfirmationBuyerHtml({
            buyerName: orderWithDetails.user.name ?? orderWithDetails.user.email,
            orderId: orderWithDetails.id,
            items: itemsForEmail,
            total: totalAmount,
            businessName
          });
  
          const adminEmails = new Set<string>();
          if (orderWithDetails.tenant.owner?.email) {
            adminEmails.add(orderWithDetails.tenant.owner.email);
          }
          for (const u of orderWithDetails.tenant.users) {
            if (u.email) adminEmails.add(u.email);
          }
  
          try {
            await sendMail({
              to: orderWithDetails.user.email,
              subject: `Confirmación de compra - ${businessName}`,
              html: buyerHtml
            });
          } catch (mailErr) {
            const err = mailErr as Error;
            logger.error("Error al enviar email al comprador:", err.message);
          }
  
          if (adminEmails.size > 0) {
            const adminHtml = await buildNewOrderAdminHtml({
              buyerName: orderWithDetails.user.name ?? orderWithDetails.user.email,
              buyerEmail: orderWithDetails.user.email,
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
              const err = mailErr as Error;
              logger.error("Error al enviar email a admins:", err.message);
            }
          }
        })
      }

      return {
        status: 200,
        message: "Orden finalizada correctamente.",
        data: { order: orderId }
      };
    } catch (error) {
      if (error instanceof CheckoutError) {
        return { status: error.status, message: error.message };
      }
      const err = error as Error;
      logger.error("Error en checkout: ", err.message);
      return { status: 500, message: "Error al procesar el checkout.", err: err.message };
    }
  }
}

export const cartService = new CartService();
