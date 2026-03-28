import {
  OrderShipmentStatus,
  Prisma,
  ShippingMethodKind,
  ShippingProviderCode,
  ShippingQuoteType,
} from "@prisma/client";
import type { z } from "zod";
import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import { normalizeText } from "../../utils/normalization.utils";
import { CheckoutError, decimalToNumber, type PrismaTransactionClient } from "../Cart/checkout.helpers";
import type {
  createShippingMethodSchema,
  shippingAddressSchema,
  shippingQuoteRequestSchema,
  shippingSelectionSchema,
  updateShippingMethodSchema,
} from "./shipping.zod";
import { shipnowService, type ShipnowAddress } from "./shipnow.service";

type ServiceResponse = { status: number; message: string; data?: unknown; err?: string };

type CartItemForShipping = {
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: unknown;
    stock: number;
    weightGrams: number | null;
    lengthCm: unknown;
    widthCm: unknown;
    heightCm: unknown;
  };
};

export type PackageSummary = {
  totalWeightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  itemCount: number;
};

const shippingMethodInclude = {
  zoneRules: {
    orderBy: [{ province: "asc" }, { locality: "asc" }],
  },
} satisfies Prisma.ShippingMethodInclude;

const orderShipmentInclude = {
  shippingMethod: {
    include: shippingMethodInclude,
  },
  quote: true,
} satisfies Prisma.OrderShipmentInclude;

const normalizeLocation = (value: string) => normalizeText(value).toLowerCase();

const decimalLikeToNumber = (value: unknown): number => {
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

function normalizeShippingAddress(
  address: z.infer<typeof shippingAddressSchema>
) {
  return {
    recipientName: address.recipientName.trim(),
    recipientPhone: address.recipientPhone.trim(),
    streetName: address.streetName.trim(),
    streetNumber: address.streetNumber.trim(),
    floor: address.floor?.trim(),
    apartment: address.apartment?.trim(),
    postalCode: address.postalCode.trim(),
    city: address.city.trim(),
    province: address.province.trim(),
    country: address.country.trim(),
    references: address.references?.trim(),
  };
}

function buildPackageSummary(items: CartItemForShipping[]): PackageSummary {
  let totalWeightGrams = 0;
  let lengthCm = 0;
  let widthCm = 0;
  let heightCm = 0;
  let itemCount = 0;

  for (const item of items) {
    const quantity = item.quantity;
    itemCount += quantity;
    totalWeightGrams += (item.product.weightGrams ?? 0) * quantity;
    lengthCm += decimalLikeToNumber(item.product.lengthCm) * quantity;
    widthCm = Math.max(widthCm, decimalLikeToNumber(item.product.widthCm));
    heightCm += decimalLikeToNumber(item.product.heightCm) * quantity;
  }

  return {
    totalWeightGrams,
    lengthCm: Math.max(1, Math.round(lengthCm)),
    widthCm: Math.max(1, Math.round(widthCm)),
    heightCm: Math.max(1, Math.round(heightCm)),
    itemCount,
  };
}

function validateDimensionalData(items: CartItemForShipping[]) {
  const missing = items
    .filter((item) =>
      item.product.weightGrams == null ||
      item.product.lengthCm == null ||
      item.product.widthCm == null ||
      item.product.heightCm == null
    )
    .map((item) => item.product.name);

  return {
    valid: missing.length === 0,
    missing,
  };
}

function normalizeMethod(method: Prisma.ShippingMethodGetPayload<{ include: typeof shippingMethodInclude }>) {
  return {
    id: method.id,
    name: method.name,
    kind: method.kind,
    providerCode: method.providerCode,
    isActive: method.isActive,
    availableInCheckout: method.availableInCheckout,
    availableInAdmin: method.availableInAdmin,
    displayOrder: method.displayOrder,
    config: method.config,
    zoneRules: method.zoneRules.map((rule) => ({
      id: rule.id,
      province: rule.province,
      locality: rule.locality,
      price: decimalToNumber(rule.price),
      isActive: rule.isActive,
      displayName: rule.displayName ?? undefined,
    })),
    createdAt: method.createdAt,
    updatedAt: method.updatedAt,
  };
}

function normalizeShipment(
  shipment: Prisma.OrderShipmentGetPayload<{ include: typeof orderShipmentInclude }>
) {
  return {
    id: shipment.id,
    status: shipment.status,
    providerCode: shipment.providerCode,
    kind: shipment.kind,
    price: decimalToNumber(shipment.price),
    currency: shipment.currency,
    serviceCode: shipment.serviceCode ?? undefined,
    serviceName: shipment.serviceName ?? undefined,
    trackingCode: shipment.trackingCode ?? undefined,
    labelUrl: shipment.labelUrl ?? undefined,
    externalShipmentId: shipment.externalShipmentId ?? undefined,
    destination: shipment.destination ?? undefined,
    pickupSnapshot: shipment.pickupSnapshot ?? undefined,
    originSnapshot: shipment.originSnapshot ?? undefined,
    shippingMethod: normalizeMethod(shipment.shippingMethod),
    quote: shipment.quote
      ? {
          id: shipment.quote.id,
          quoteType: shipment.quote.quoteType,
          price: decimalToNumber(shipment.quote.price),
          currency: shipment.quote.currency,
          serviceCode: shipment.quote.serviceCode ?? undefined,
          serviceName: shipment.quote.serviceName ?? undefined,
        }
      : null,
    pickedUpAt: shipment.pickedUpAt,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

async function getCartItemsForShipping(input: {
  tenantId: string;
  userId?: string;
  guestCartToken?: string | null;
}): Promise<CartItemForShipping[]> {
  if (input.userId) {
    const cart = await prisma.cart.findUnique({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
      select: {
        items: {
          select: {
            productId: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                weightGrams: true,
                lengthCm: true,
                widthCm: true,
                heightCm: true,
              },
            },
          },
        },
      },
    });
    return (cart?.items ?? []) as CartItemForShipping[];
  }

  if (!input.guestCartToken) {
    return [];
  }

  const cart = await prisma.guestCart.findUnique({
    where: { tenantId_token: { tenantId: input.tenantId, token: input.guestCartToken } },
    select: {
      items: {
        select: {
          productId: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              weightGrams: true,
              lengthCm: true,
              widthCm: true,
              heightCm: true,
            },
          },
        },
      },
    },
  });

  return (cart?.items ?? []) as CartItemForShipping[];
}

async function getBusinessShippingSnapshot(
  tenantId: string,
  tx?: PrismaTransactionClient
): Promise<{
  address?: string | null;
  province?: string | null;
  businessHours?: string | null;
}> {
  const client = tx ?? prisma;
  const business = await client.businessData.findUnique({
    where: { tenantId },
    select: {
      address: true,
      province: true,
      businessHours: true,
    },
  });

  return {
    address: business?.address ?? null,
    province: business?.province ?? null,
    businessHours: business?.businessHours ?? null,
  };
}

export class ShippingService {
  async listMethods(tenantId: string): Promise<ServiceResponse> {
    try {
      const methods = await prisma.shippingMethod.findMany({
        where: { tenantId },
        include: shippingMethodInclude,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });

      return {
        status: 200,
        message: "Formas de envío obtenidas.",
        data: methods.map(normalizeMethod),
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping listMethods", { message: err.message });
      return { status: 500, message: "Error al obtener formas de envío.", err: err.message };
    }
  }

  async createMethod(
    tenantId: string,
    data: z.infer<typeof createShippingMethodSchema>
  ): Promise<ServiceResponse> {
    try {
      const method = await prisma.shippingMethod.create({
        data: {
          tenantId,
          name: data.name.trim(),
          kind: data.kind,
          providerCode: data.providerCode,
          isActive: data.isActive ?? true,
          availableInCheckout: data.availableInCheckout ?? true,
          availableInAdmin: data.availableInAdmin ?? true,
          displayOrder: data.displayOrder ?? 0,
          config: (data.config ?? undefined) as Prisma.InputJsonValue | undefined,
          zoneRules: data.zoneRules?.length
            ? {
                create: data.zoneRules.map((rule) => ({
                  province: rule.province.trim(),
                  locality: rule.locality?.trim() ?? null,
                  price: rule.price,
                  isActive: rule.isActive,
                  displayName: rule.displayName?.trim() ?? null,
                })),
              }
            : undefined,
        },
        include: shippingMethodInclude,
      });

      return {
        status: 201,
        message: "Forma de envío creada.",
        data: normalizeMethod(method),
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping createMethod", { message: err.message });
      return { status: 500, message: "Error al crear forma de envío.", err: err.message };
    }
  }

  async updateMethod(
    tenantId: string,
    methodId: string,
    data: z.infer<typeof updateShippingMethodSchema>
  ): Promise<ServiceResponse> {
    try {
      const existing = await prisma.shippingMethod.findFirst({
        where: { id: methodId, tenantId },
        include: shippingMethodInclude,
      });
      if (!existing) {
        return { status: 404, message: "Forma de envío no encontrada." };
      }

      const method = await prisma.$transaction(async (tx) => {
        if (data.zoneRules) {
          await tx.shippingZoneRule.deleteMany({ where: { shippingMethodId: methodId } });
        }

        return tx.shippingMethod.update({
          where: { id: methodId },
          data: {
            ...(data.name !== undefined ? { name: data.name.trim() } : {}),
            ...(data.kind !== undefined ? { kind: data.kind } : {}),
            ...(data.providerCode !== undefined ? { providerCode: data.providerCode } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.availableInCheckout !== undefined ? { availableInCheckout: data.availableInCheckout } : {}),
            ...(data.availableInAdmin !== undefined ? { availableInAdmin: data.availableInAdmin } : {}),
            ...(data.displayOrder !== undefined ? { displayOrder: data.displayOrder } : {}),
            ...(data.config !== undefined ? { config: data.config as Prisma.InputJsonValue } : {}),
            ...(data.zoneRules
              ? {
                  zoneRules: {
                    create: data.zoneRules.map((rule) => ({
                      province: rule.province.trim(),
                      locality: rule.locality?.trim() ?? null,
                      price: rule.price,
                      isActive: rule.isActive,
                      displayName: rule.displayName?.trim() ?? null,
                    })),
                  },
                }
              : {}),
          },
          include: shippingMethodInclude,
        });
      });

      return {
        status: 200,
        message: "Forma de envío actualizada.",
        data: normalizeMethod(method),
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping updateMethod", { message: err.message });
      return { status: 500, message: "Error al actualizar forma de envío.", err: err.message };
    }
  }

  async patchMethodStatus(tenantId: string, methodId: string, isActive: boolean): Promise<ServiceResponse> {
    try {
      const method = await prisma.shippingMethod.findFirst({
        where: { id: methodId, tenantId },
      });
      if (!method) {
        return { status: 404, message: "Forma de envío no encontrada." };
      }

      const updated = await prisma.shippingMethod.update({
        where: { id: methodId },
        data: { isActive },
        include: shippingMethodInclude,
      });

      return {
        status: 200,
        message: "Estado de forma de envío actualizado.",
        data: normalizeMethod(updated),
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping patchMethodStatus", { message: err.message });
      return { status: 500, message: "Error al actualizar estado.", err: err.message };
    }
  }

  async deleteMethod(tenantId: string, methodId: string): Promise<ServiceResponse> {
    try {
      const method = await prisma.shippingMethod.findFirst({
        where: { id: methodId, tenantId },
        select: { id: true },
      });
      if (!method) {
        return { status: 404, message: "Forma de envío no encontrada." };
      }

      await prisma.shippingMethod.delete({ where: { id: methodId } });
      return { status: 200, message: "Forma de envío eliminada." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping deleteMethod", { message: err.message });
      return { status: 500, message: "Error al eliminar forma de envío.", err: err.message };
    }
  }

  async quoteForCart(input: {
    tenantId: string;
    userId?: string;
    guestCartToken?: string | null;
    quoteType: ShippingQuoteType;
    shippingAddress?: z.infer<typeof shippingAddressSchema>;
  }): Promise<ServiceResponse> {
    try {
      const items = await getCartItemsForShipping(input);
      if (items.length === 0) {
        return { status: 400, message: "El carrito está vacío." };
      }

      const methods = await prisma.shippingMethod.findMany({
        where: {
          tenantId: input.tenantId,
          isActive: true,
          availableInCheckout: true,
        },
        include: shippingMethodInclude,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });

      const packageSummary = buildPackageSummary(items);
      const destination = input.shippingAddress ? normalizeShippingAddress(input.shippingAddress) : undefined;
      const quotes: Array<Record<string, unknown>> = [];
      const businessSnapshot = await getBusinessShippingSnapshot(input.tenantId);

      for (const method of methods) {
        if (input.quoteType === ShippingQuoteType.PICKUP && method.kind !== ShippingMethodKind.PICKUP) {
          continue;
        }
        if (input.quoteType === ShippingQuoteType.HOME_DELIVERY && method.kind === ShippingMethodKind.PICKUP) {
          continue;
        }

        if (method.providerCode === ShippingProviderCode.LOCAL_PICKUP) {
          const pickupDetails = {
            ...(method.config && typeof method.config === "object" && !Array.isArray(method.config) ? method.config : {}),
            businessHours: businessSnapshot.businessHours ?? undefined,
            address: businessSnapshot.address ?? undefined,
            province: businessSnapshot.province ?? undefined,
          };
          const quote = await prisma.shipmentQuote.create({
            data: {
              tenantId: input.tenantId,
              shippingMethodId: method.id,
              providerCode: method.providerCode,
              quoteType: ShippingQuoteType.PICKUP,
              serviceCode: "pickup",
              serviceName: method.name,
              price: 0,
              currency: "ARS",
              packageSummary: packageSummary as unknown as Prisma.InputJsonValue,
              providerPayload: pickupDetails as Prisma.InputJsonValue,
            },
          });

          quotes.push({
            id: quote.id,
            shippingMethodId: method.id,
            providerCode: method.providerCode,
            kind: method.kind,
            quoteType: quote.quoteType,
            serviceCode: quote.serviceCode,
            serviceName: quote.serviceName,
            price: 0,
            currency: quote.currency,
            methodName: method.name,
            pickupDetails,
          });
          continue;
        }

        if (!destination) {
          continue;
        }

        if (method.providerCode === ShippingProviderCode.CUSTOM_EXTERNAL) {
          const rule = method.zoneRules.find((zoneRule) => {
            if (!zoneRule.isActive) return false;
            const provinceMatch = normalizeLocation(zoneRule.province) === normalizeLocation(destination.province);
            if (!provinceMatch) return false;
            // If locality is not set, match by province only; otherwise match both
            if (!zoneRule.locality || zoneRule.locality.trim() === '') return true;
            return normalizeLocation(zoneRule.locality) === normalizeLocation(destination.city);
          });

          if (!rule) {
            continue;
          }

          const quote = await prisma.shipmentQuote.create({
            data: {
              tenantId: input.tenantId,
              shippingMethodId: method.id,
              providerCode: method.providerCode,
              quoteType: ShippingQuoteType.HOME_DELIVERY,
              serviceCode: "external-fixed-rate",
              serviceName: method.name,
              price: rule.price,
              currency: "ARS",
              destination: destination as unknown as Prisma.InputJsonValue,
              packageSummary: packageSummary as unknown as Prisma.InputJsonValue,
              providerPayload: {
                zoneRuleId: rule.id,
                displayName: rule.displayName,
              } as Prisma.InputJsonValue,
            },
          });

          quotes.push({
            id: quote.id,
            shippingMethodId: method.id,
            providerCode: method.providerCode,
            kind: method.kind,
            quoteType: quote.quoteType,
            serviceCode: quote.serviceCode,
            serviceName: quote.serviceName,
            price: decimalToNumber(rule.price),
            currency: quote.currency,
            methodName: method.name,
          });
          continue;
        }

        // ShipNow Integration
        if (method.providerCode === ShippingProviderCode.SHIPNOW && shipnowService.isAvailable()) {
          try {
            const originAddress: ShipnowAddress = {
              name: businessSnapshot.address ? businessSnapshot.address.split(',')[0]?.trim() || 'Local' : 'Local',
              street: businessSnapshot.address ? businessSnapshot.address.split(',')[0]?.trim() || '' : '',
              number: '1',
              city: businessSnapshot.province || 'Buenos Aires',
              province: businessSnapshot.province || 'Buenos Aires',
              postal_code: '1000',
              phone: '',
            };

            const destinationAddress: ShipnowAddress = {
              name: destination.recipientName,
              street: destination.streetName,
              number: destination.streetNumber,
              city: destination.city,
              province: destination.province,
              postal_code: destination.postalCode,
              phone: destination.recipientPhone,
              floor: destination.floor,
              apartment: destination.apartment,
              references: destination.references,
            };

            const shipnowRates = await shipnowService.getRates(
              originAddress,
              destinationAddress,
              packageSummary
            );

            for (const rate of shipnowRates) {
              const quote = await prisma.shipmentQuote.create({
                data: {
                  tenantId: input.tenantId,
                  shippingMethodId: method.id,
                  providerCode: method.providerCode,
                  quoteType: ShippingQuoteType.HOME_DELIVERY,
                  serviceCode: rate.service_code,
                  serviceName: `${rate.carrier} - ${rate.service}`,
                  price: new Prisma.Decimal(rate.price),
                  currency: rate.currency || "ARS",
                  destination: destination as unknown as Prisma.InputJsonValue,
                  packageSummary: packageSummary as unknown as Prisma.InputJsonValue,
                  providerPayload: {
                    rateId: rate.id,
                    carrier: rate.carrier,
                    service: rate.service,
                    estimatedDelivery: rate.estimated_delivery,
                    trackingAvailable: rate.tracking_available,
                  } as Prisma.InputJsonValue,
                },
              });

              quotes.push({
                id: quote.id,
                shippingMethodId: method.id,
                providerCode: method.providerCode,
                kind: method.kind,
                quoteType: quote.quoteType,
                serviceCode: quote.serviceCode,
                serviceName: quote.serviceName,
                price: rate.price,
                currency: quote.currency,
                methodName: method.name,
                estimatedDelivery: rate.estimated_delivery,
                carrier: rate.carrier,
              });
            }
          } catch (error) {
            logger.error("Error al cotizar con ShipNow", { 
              error: (error as Error).message,
              tenantId: input.tenantId 
            });
            // No agregamos nada a quotes si falla ShipNow, continuamos con otros métodos
          }
          continue;
        }

        if (method.kind === ShippingMethodKind.THIRD_PARTY) {
          quotes.push({
            shippingMethodId: method.id,
            providerCode: method.providerCode,
            kind: method.kind,
            methodName: method.name,
            unavailableReason: "Este courier todavía no está disponible.",
          });
        }
      }

      return {
        status: 200,
        message: "Cotizaciones de envío obtenidas.",
        data: {
          items: quotes,
          packageSummary,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping quoteForCart", { message: err.message });
      return { status: 500, message: "No se pudo cotizar el envío.", err: err.message };
    }
  }

  async attachShipmentToOrder(
    tx: PrismaTransactionClient,
    input: {
      tenantId: string;
      orderId: string;
      items: CartItemForShipping[];
      selection: z.infer<typeof shippingSelectionSchema>;
    }
  ): Promise<number> {
    const method = await tx.shippingMethod.findFirst({
      where: {
        id: input.selection.shippingMethodId,
        tenantId: input.tenantId,
        isActive: true,
      },
      include: shippingMethodInclude,
    });

    if (!method) {
      throw new CheckoutError(400, "La forma de envío seleccionada no está disponible.");
    }

    if (input.selection.shippingSelectionType === ShippingQuoteType.PICKUP && method.kind !== ShippingMethodKind.PICKUP) {
      throw new CheckoutError(400, "La forma de envío seleccionada no corresponde a retiro en local.");
    }

    if (input.selection.shippingSelectionType === ShippingQuoteType.HOME_DELIVERY && method.kind === ShippingMethodKind.PICKUP) {
      throw new CheckoutError(400, "La forma de envío seleccionada no corresponde a envío a domicilio.");
    }

    const packageSummary = buildPackageSummary(input.items);
    const businessSnapshot = await getBusinessShippingSnapshot(input.tenantId, tx);
    let quote = input.selection.shippingQuoteId
      ? await tx.shipmentQuote.findFirst({
          where: {
            id: input.selection.shippingQuoteId,
            tenantId: input.tenantId,
            shippingMethodId: method.id,
          },
        })
      : null;

    let destinationJson: Prisma.InputJsonValue | undefined;
    let pickupSnapshot: Prisma.InputJsonValue | undefined;
    let serviceCode: string | undefined;
    let serviceName: string | undefined;
    let price = 0;
    let providerQuotePayload: Prisma.InputJsonValue | undefined;
    let status: OrderShipmentStatus = OrderShipmentStatus.QUOTED;

    if (method.providerCode === ShippingProviderCode.LOCAL_PICKUP) {
      pickupSnapshot = {
        ...(method.config && typeof method.config === "object" && !Array.isArray(method.config) ? method.config : {}),
        businessHours: businessSnapshot.businessHours ?? undefined,
        address: businessSnapshot.address ?? undefined,
        province: businessSnapshot.province ?? undefined,
      } as Prisma.InputJsonValue;
      serviceCode = "pickup";
      serviceName = method.name;
      price = 0;
      status = OrderShipmentStatus.READY_FOR_PICKUP;
    } else if (method.kind === ShippingMethodKind.THIRD_PARTY) {
      throw new CheckoutError(400, "Este courier todavía no está disponible.");
    } else {
      if (!input.selection.shippingAddress) {
        throw new CheckoutError(400, "La dirección de envío es requerida.");
      }
      destinationJson = normalizeShippingAddress(input.selection.shippingAddress) as unknown as Prisma.InputJsonValue;
      if (!quote) {
        throw new CheckoutError(400, "La cotización de envío seleccionada no es válida.");
      }
      serviceCode = quote.serviceCode ?? undefined;
      serviceName = quote.serviceName ?? method.name;
      price = decimalToNumber(quote.price);
      providerQuotePayload = quote.providerPayload as Prisma.InputJsonValue | undefined;
    }

    await tx.orderShipment.create({
      data: {
        orderId: input.orderId,
        shippingMethodId: method.id,
        quoteId: quote?.id,
        providerCode: method.providerCode,
        kind: method.kind,
        status,
        price,
        currency: quote?.currency ?? "ARS",
        serviceCode,
        serviceName,
        destination: destinationJson,
        pickupSnapshot,
        originSnapshot: undefined,
        providerQuotePayload,
      },
    });

    return price;
  }

  async createShipmentForSale(tenantId: string, saleId: string): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        select: {
          id: true,
          order: {
            select: {
              id: true,
              guestName: true,
              guestPhone: true,
              shipment: {
                include: {
                  shippingMethod: true,
                  quote: true,
                },
              },
              items: {
                select: {
                  quantity: true,
                  productId: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      stock: true,
                      weightGrams: true,
                      lengthCm: true,
                      widthCm: true,
                      heightCm: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!sale?.order?.shipment) {
        return { status: 404, message: "La venta no tiene un envío asociado." };
      }

      const shipment = sale.order.shipment;
      if (shipment.providerCode === ShippingProviderCode.LOCAL_PICKUP) {
        const updated = await prisma.orderShipment.update({
          where: { id: shipment.id },
          data: { status: OrderShipmentStatus.READY_FOR_PICKUP },
          include: orderShipmentInclude,
        });
        return { status: 200, message: "Pedido listo para retiro.", data: normalizeShipment(updated) };
      }

      if (shipment.providerCode === ShippingProviderCode.CUSTOM_EXTERNAL) {
        const updated = await prisma.orderShipment.update({
          where: { id: shipment.id },
          data: { status: OrderShipmentStatus.PREPARING },
          include: orderShipmentInclude,
        });
        return { status: 200, message: "Envío manual preparado.", data: normalizeShipment(updated) };
      }

      // ShipNow Integration - Crear envío real en ShipNow
      if (shipment.providerCode === ShippingProviderCode.SHIPNOW && shipnowService.isAvailable()) {
        try {
          // Obtener los datos necesarios del negocio
          const business = await prisma.businessData.findUnique({
            where: { tenantId },
            select: {
              address: true,
              province: true,
            },
          });

          const originAddress: ShipnowAddress = {
            name: business?.address?.split(',')[0]?.trim() || 'Local',
            street: business?.address?.split(',')[0]?.trim() || '',
            number: '1',
            city: business?.province || 'Buenos Aires',
            province: business?.province || 'Buenos Aires',
            postal_code: '1000',
            phone: '',
          };

          const destination = shipment.destination as unknown as {
            recipientName: string;
            recipientPhone: string;
            streetName: string;
            streetNumber: string;
            city: string;
            province: string;
            postalCode: string;
            floor?: string;
            apartment?: string;
            references?: string;
          };

          const destinationAddress: ShipnowAddress = {
            name: destination.recipientName,
            street: destination.streetName,
            number: destination.streetNumber,
            city: destination.city,
            province: destination.province,
            postal_code: destination.postalCode,
            phone: destination.recipientPhone,
            floor: destination.floor,
            apartment: destination.apartment,
            references: destination.references,
          };

          // Construir package summary
          const packageSummary = buildPackageSummary(sale.order.items as CartItemForShipping[]);

          // Obtener rateId del payload guardado
          const providerPayload = shipment.providerQuotePayload as { rateId: string } | null;
          const rateId = providerPayload?.rateId;

          if (!rateId) {
            throw new Error("No se encontró el rateId de ShipNow en la cotización");
          }

          // Crear envío en ShipNow
          const shipnowShipment = await shipnowService.createShipment(
            rateId,
            originAddress,
            destinationAddress,
            packageSummary,
            sale.order.id,
            `Venta: ${sale.id}`
          );

          // Actualizar el envío local con los datos de ShipNow
          const updated = await prisma.orderShipment.update({
            where: { id: shipment.id },
            data: {
              status: OrderShipmentStatus.SHIPPED,
              trackingCode: shipnowShipment.tracking_code,
              labelUrl: shipnowShipment.label_url,
              externalShipmentId: shipnowShipment.id,
              shippedAt: new Date(),
            },
            include: orderShipmentInclude,
          });

          return { 
            status: 200, 
            message: "Envío creado exitosamente en ShipNow.", 
            data: normalizeShipment(updated) 
          };
        } catch (error) {
          logger.error("Error al crear envío en ShipNow", { 
            error: (error as Error).message,
            saleId,
            tenantId 
          });
          return { 
            status: 500, 
            message: "Error al crear envío en ShipNow.", 
            err: (error as Error).message 
          };
        }
      }

      return { status: 400, message: "No hay couriers integrados activos por el momento." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping createShipmentForSale", { message: err.message });
      return { status: 500, message: "No se pudo generar el envío.", err: err.message };
    }
  }

  async refreshShipmentForSale(tenantId: string, saleId: string): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        select: {
          order: {
            select: {
              shipment: {
                include: {
                  shippingMethod: true,
                  quote: true,
                },
              },
            },
          },
        },
      });
      const shipment = sale?.order?.shipment;
      if (!shipment) {
        return { status: 404, message: "La venta no tiene un envío asociado." };
      }

      if (shipment.providerCode === ShippingProviderCode.LOCAL_PICKUP || shipment.providerCode === ShippingProviderCode.CUSTOM_EXTERNAL) {
        const current = await prisma.orderShipment.findUnique({
          where: { id: shipment.id },
          include: orderShipmentInclude,
        });
        return { status: 200, message: "Envío sin tracking externo.", data: current ? normalizeShipment(current) : null };
      }

      // ShipNow Integration - Consultar estado del envío
      if (shipment.providerCode === ShippingProviderCode.SHIPNOW && shipnowService.isAvailable() && shipment.externalShipmentId) {
        try {
          const shipnowStatus = await shipnowService.getShipmentStatus(shipment.externalShipmentId);
          
          // Mapear el estado de ShipNow a nuestro estado interno
          let newStatus = shipment.status;
          if (shipnowStatus.status === 'delivered') {
            newStatus = OrderShipmentStatus.DELIVERED;
          } else if (shipnowStatus.status === 'in_transit') {
            newStatus = OrderShipmentStatus.SHIPPED;
          } else if (shipnowStatus.status === 'ready_for_pickup') {
            newStatus = OrderShipmentStatus.READY_FOR_PICKUP;
          }

          // Actualizar si el estado cambió
          if (newStatus !== shipment.status || shipnowStatus.events.length > 0) {
            const updated = await prisma.orderShipment.update({
              where: { id: shipment.id },
              data: {
                status: newStatus,
                ...(newStatus === OrderShipmentStatus.DELIVERED && !shipment.deliveredAt ? { deliveredAt: new Date() } : {}),
                providerShipmentPayload: {
                  lastEvent: shipnowStatus.events[0],
                  allEvents: shipnowStatus.events,
                } as unknown as Prisma.InputJsonValue,
              },
              include: orderShipmentInclude,
            });

            return { 
              status: 200, 
              message: "Estado del envío actualizado desde ShipNow.", 
              data: normalizeShipment(updated) 
            };
          }

          return { 
            status: 200, 
            message: "Estado del envío consultado en ShipNow.", 
            data: normalizeShipment(shipment as unknown as Prisma.OrderShipmentGetPayload<{ include: typeof orderShipmentInclude }>) 
          };
        } catch (error) {
          logger.error("Error al consultar estado en ShipNow", { 
            error: (error as Error).message,
            shipmentId: shipment.id,
            externalId: shipment.externalShipmentId 
          });
          // Retornar el estado actual sin actualizar
          return { 
            status: 200, 
            message: "No se pudo consultar ShipNow, se mantiene estado actual.", 
            data: normalizeShipment(shipment as unknown as Prisma.OrderShipmentGetPayload<{ include: typeof orderShipmentInclude }>) 
          };
        }
      }

      return { status: 400, message: "No hay couriers integrados activos por el momento." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping refreshShipmentForSale", { message: err.message });
      return { status: 500, message: "No se pudo actualizar el estado del envío.", err: err.message };
    }
  }

  async reQuoteShipmentForSale(tenantId: string, saleId: string): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        select: {
          order: {
            select: {
              shipment: {
                include: {
                  shippingMethod: {
                    include: shippingMethodInclude,
                  },
                },
              },
              items: {
                select: {
                  quantity: true,
                  productId: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      stock: true,
                      weightGrams: true,
                      lengthCm: true,
                      widthCm: true,
                      heightCm: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const order = sale?.order;
      const shipment = order?.shipment;
      if (!order || !shipment) {
        return { status: 404, message: "La venta no tiene un envío asociado." };
      }

      if (shipment.providerCode !== ShippingProviderCode.CUSTOM_EXTERNAL) {
        const current = await prisma.orderShipment.findUnique({
          where: { id: shipment.id },
          include: orderShipmentInclude,
        });
        return { status: 200, message: "La forma de envío no requiere recotización externa.", data: current ? normalizeShipment(current) : null };
      }
      const current = await prisma.orderShipment.findUnique({
        where: { id: shipment.id },
        include: orderShipmentInclude,
      });
      return { status: 200, message: "La forma de envío usa precio fijo por zona.", data: current ? normalizeShipment(current) : null };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping reQuoteShipmentForSale", { message: err.message });
      return { status: 500, message: "No se pudo recotizar el envío.", err: err.message };
    }
  }

  async markPickedUp(tenantId: string, saleId: string): Promise<ServiceResponse> {
    try {
      const sale = await prisma.sales.findFirst({
        where: { id: saleId, tenantId },
        select: {
          order: {
            select: {
              shipment: true,
            },
          },
        },
      });
      const shipment = sale?.order?.shipment;
      if (!shipment) {
        return { status: 404, message: "La venta no tiene un envío asociado." };
      }
      if (shipment.providerCode !== ShippingProviderCode.LOCAL_PICKUP) {
        return { status: 400, message: "Solo aplica a retiro en local." };
      }

      const updated = await prisma.orderShipment.update({
        where: { id: shipment.id },
        data: {
          status: OrderShipmentStatus.DELIVERED,
          pickedUpAt: new Date(),
          deliveredAt: new Date(),
        },
        include: orderShipmentInclude,
      });

      return { status: 200, message: "Pedido marcado como retirado.", data: normalizeShipment(updated) };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en shipping markPickedUp", { message: err.message });
      return { status: 500, message: "No se pudo marcar el retiro.", err: err.message };
    }
  }
}

export const shippingService = new ShippingService();
