import { PaymentStatus, Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import type { PrismaTransactionClient } from "../Cart/checkout.helpers";
import type { z } from "zod";
import type { listSalesQuerySchema, patchSaleItemsSchema, updateSaleSchema } from "./sales.zod";

const decimalToNumber = (value: unknown): number => {
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

type ServiceResponse = { status: number; message: string; data?: unknown; err?: string };

export class SalesService {
  async list(
    tenantId: string,
    query: z.infer<typeof listSalesQuerySchema>
  ): Promise<ServiceResponse> {
    try {
      const { page, limit, from, to, sortBy, sortOrder } = query;
      const skip = (page - 1) * limit;

      const fromDate = from ? new Date(from) : null;
      const toDate = to
        ? (() => {
            const d = new Date(to);
            d.setUTCDate(d.getUTCDate() + 1);
            return d;
          })()
        : null;

      const where: Prisma.SalesWhereInput = {
        tenantId,
        ...(fromDate || toDate
          ? {
              saleDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lt: toDate } : {})
              }
            }
          : {})
      };

      const orderBy: Prisma.SalesOrderByWithRelationInput =
        sortBy === "total"
          ? { total: sortOrder }
          : sortBy === "createdAt"
            ? { createdAt: sortOrder }
            : { saleDate: sortOrder };

      const [items, total] = await Promise.all([
        prisma.sales.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            order: {
              select: {
                id: true,
                user: { select: { email: true, name: true } },
                items: {
                  select: {
                    id: true,
                    quantity: true,
                    unitPrice: true,
                    product: { select: { id: true, name: true, image: true } }
                  }
                }
              }
            },
            orderItem: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                product: { select: { id: true, name: true, image: true } }
              }
            }
          }
        }),
        prisma.sales.count({ where })
      ]);

      const normalized = items.map((s) => ({
        id: s.id,
        total: decimalToNumber(s.total),
        saleDate: s.saleDate,
        status: s.status,
        paymentProvider: s.paymentProvider,
        currency: s.currency,
        orderId: s.orderId,
        orderItemId: s.orderItemId,
        order: s.order
          ? {
              id: s.order.id,
              user: s.order.user,
              items: s.order.items.map((i) => ({
                id: i.id,
                quantity: i.quantity,
                unitPrice: decimalToNumber(i.unitPrice),
                product: i.product
              }))
            }
          : null,
        orderItem: s.orderItem
          ? {
              id: s.orderItem.id,
              quantity: s.orderItem.quantity,
              unitPrice: decimalToNumber(s.orderItem.unitPrice),
              product: s.orderItem.product
            }
          : null
      }));

      return {
        status: 200,
        message: "Ventas obtenidas.",
        data: {
          items: normalized,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales list:", err.message);
      return { status: 500, message: "Error al listar ventas.", err: err.message };
    }
  }

  async getOne(tenantId: string, saleId: string): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        include: {
          order: {
            select: {
              id: true,
              user: { select: { email: true, name: true } },
              items: {
                select: {
                  id: true,
                  quantity: true,
                  unitPrice: true,
                  product: { select: { id: true, name: true, image: true, stock: true } }
                }
              }
            }
          },
          orderItem: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              product: { select: { id: true, name: true, image: true, stock: true } }
            }
          }
        }
      });

      if (!sale) {
        return { status: 404, message: "Venta no encontrada." };
      }

      const normalized = {
        ...sale,
        total: decimalToNumber(sale.total),
        order: sale.order
          ? {
              ...sale.order,
              items: sale.order.items.map((i) => ({
                ...i,
                unitPrice: decimalToNumber(i.unitPrice)
              }))
            }
          : null,
        orderItem: sale.orderItem
          ? {
              ...sale.orderItem,
              unitPrice: decimalToNumber(sale.orderItem.unitPrice)
            }
          : null
      };

      return { status: 200, message: "Venta obtenida.", data: normalized };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales getOne:", err.message);
      return { status: 500, message: "Error al obtener venta.", err: err.message };
    }
  }

  async getMetrics(
    tenantId: string,
    from: string,
    to: string,
    groupBy: "day" | "week" | "month" = "day"
  ): Promise<ServiceResponse> {
    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setUTCDate(toDate.getUTCDate() + 1);

      const sales = await prisma.sales.findMany({
        where: {
          tenantId,
          saleDate: { gte: fromDate, lt: toDate }
        },
        select: { saleDate: true, total: true }
      });

      const grouped = new Map<string, number>();
      for (const s of sales) {
        const d = new Date(s.saleDate);
        let key: string;
        if (groupBy === "day") {
          key = d.toISOString().slice(0, 10);
        } else if (groupBy === "week") {
          const start = new Date(d);
          start.setDate(start.getDate() - start.getDay());
          key = start.toISOString().slice(0, 10);
        } else {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }
        const prev = grouped.get(key) ?? 0;
        grouped.set(key, prev + decimalToNumber(s.total));
      }

      const data = Array.from(grouped.entries())
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        status: 200,
        message: "Métricas obtenidas.",
        data: { series: data }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales getMetrics:", err.message);
      return { status: 500, message: "Error al obtener métricas.", err: err.message };
    }
  }

  async update(
    tenantId: string,
    saleId: string,
    data: z.infer<typeof updateSaleSchema>
  ): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId }
      });

      if (!sale) {
        return { status: 404, message: "Venta no encontrada." };
      }

      const updateData: { discount?: number; status?: PaymentStatus } = {};
      if (data.discount !== undefined) updateData.discount = data.discount;
      if (data.status !== undefined) updateData.status = data.status;

      if (Object.keys(updateData).length === 0) {
        return { status: 400, message: "No hay datos para actualizar." };
      }

      await prisma.sales.update({
        where: { id: saleId },
        data: updateData
      });

      return { status: 200, message: "Venta actualizada." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales update:", err.message);
      return { status: 500, message: "Error al actualizar venta.", err: err.message };
    }
  }

  async patchItems(
    tenantId: string,
    saleId: string,
    data: z.infer<typeof patchSaleItemsSchema>
  ): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        include: {
          order: { select: { id: true, items: { select: { id: true, productId: true, quantity: true } } } },
          orderItem: { select: { id: true, productId: true, quantity: true } }
        }
      });

      if (!sale) {
        return { status: 404, message: "Venta no encontrada." };
      }

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        if (sale.orderId && sale.order) {
          const orderItemIds = new Set(sale.order.items.map((i) => i.id));
          if (data.removeItemIds) {
            for (const oiId of data.removeItemIds) {
              if (!orderItemIds.has(oiId)) continue;
              const oi = sale.order!.items.find((i) => i.id === oiId);
              if (oi) {
                await tx.products.update({
                  where: { id: oi.productId },
                  data: { stock: { increment: oi.quantity } }
                });
                await tx.orderItem.delete({ where: { id: oiId } });
              }
            }
          }
          if (data.replaceItems) {
            for (const r of data.replaceItems) {
              const oi = sale.order!.items.find((i) => i.id === r.orderItemId);
              if (!oi) continue;
              await tx.products.update({
                where: { id: oi.productId },
                data: { stock: { increment: oi.quantity } }
              });
              const product = await tx.products.findFirst({
                where: { id: r.productId, tenantId },
                select: { id: true, price: true, stock: true }
              });
              if (!product || product.stock < r.quantity) {
                throw new Error(`Stock insuficiente para producto ${r.productId}`);
              }
              await tx.products.update({
                where: { id: r.productId },
                data: { stock: { decrement: r.quantity } }
              });
              await tx.orderItem.update({
                where: { id: r.orderItemId },
                data: {
                  productId: r.productId,
                  quantity: r.quantity,
                  unitPrice: product.price
                }
              });
            }
          }
          const newTotal = await this.recalcSaleTotalFromOrder(tx, sale.order!.id);
          await tx.sales.update({ where: { id: saleId }, data: { total: newTotal } });
        } else if (sale.orderItemId && sale.orderItem) {
          if (data.removeItemIds?.includes(sale.orderItem.id)) {
            await tx.products.update({
              where: { id: sale.orderItem.productId },
              data: { stock: { increment: sale.orderItem.quantity } }
            });
            await tx.orderItem.delete({ where: { id: sale.orderItem.id } });
            await tx.sales.delete({ where: { id: saleId } });
            return;
          }
          const repl = data.replaceItems?.find((r) => r.orderItemId === sale.orderItem!.id);
          if (repl) {
            await tx.products.update({
              where: { id: sale.orderItem.productId },
              data: { stock: { increment: sale.orderItem.quantity } }
            });
            const product = await tx.products.findFirst({
              where: { id: repl.productId, tenantId },
              select: { id: true, price: true, stock: true }
            });
            if (!product || product.stock < repl.quantity) {
              throw new Error(`Stock insuficiente para producto ${repl.productId}`);
            }
            await tx.products.update({
              where: { id: repl.productId },
              data: { stock: { decrement: repl.quantity } }
            });
            const newTotal = decimalToNumber(product.price) * repl.quantity;
            await tx.orderItem.update({
              where: { id: sale.orderItem.id },
              data: {
                productId: repl.productId,
                quantity: repl.quantity,
                unitPrice: product.price
              }
            });
            await tx.sales.update({
              where: { id: saleId },
              data: { total: newTotal }
            });
          }
        }
      });

      return { status: 200, message: "Venta actualizada." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales patchItems:", err.message);
      return {
        status: err.message.includes("Stock") ? 409 : 500,
        message: err.message.includes("Stock") ? err.message : "Error al actualizar venta.",
        err: err.message
      };
    }
  }

  private async recalcSaleTotalFromOrder(
    tx: PrismaTransactionClient,
    orderId: string
  ): Promise<number> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { quantity: true, unitPrice: true }
    });
    return items.reduce((sum, i) => sum + decimalToNumber(i.unitPrice) * i.quantity, 0);
  }

  async delete(tenantId: string, saleId: string): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        include: {
          order: { select: { id: true, items: { select: { id: true, productId: true, quantity: true } } } },
          orderItem: { select: { id: true, productId: true, quantity: true } }
        }
      });

      if (!sale) {
        return { status: 404, message: "Venta no encontrada." };
      }

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        if (sale.orderId && sale.order) {
          for (const oi of sale.order.items) {
            await tx.products.update({
              where: { id: oi.productId },
              data: { stock: { increment: oi.quantity } }
            });
          }
          await tx.orderItem.deleteMany({ where: { orderId: sale.order!.id } });
          await tx.order.delete({ where: { id: sale.order!.id } });
        } else if (sale.orderItemId && sale.orderItem) {
          await tx.products.update({
            where: { id: sale.orderItem.productId },
            data: { stock: { increment: sale.orderItem.quantity } }
          });
          await tx.orderItem.delete({ where: { id: sale.orderItem.id } });
        }
        await tx.sales.delete({ where: { id: saleId } });
      });

      return { status: 200, message: "Venta eliminada." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en sales delete:", err.message);
      return { status: 500, message: "Error al eliminar venta.", err: err.message };
    }
  }
}

export const salesService = new SalesService();
