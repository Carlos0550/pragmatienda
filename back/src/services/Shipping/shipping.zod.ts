import {
  OrderShipmentStatus,
  ShippingMethodKind,
  ShippingProviderCode,
  ShippingQuoteType,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1).optional()
);

export const shippingAddressSchema = z.object({
  recipientName: z.string().trim().min(2),
  recipientPhone: z.string().trim().min(6),
  streetName: z.string().trim().min(2),
  streetNumber: z.string().trim().min(1),
  floor: optionalTrimmedString,
  apartment: optionalTrimmedString,
  postalCode: z.string().trim().min(3),
  city: z.string().trim().min(2),
  province: z.string().trim().min(2),
  country: z.string().trim().min(2).default("Argentina"),
  references: optionalTrimmedString,
}).strict();

export const shippingZoneRuleSchema = z.object({
  id: z.string().cuid().optional(),
  province: z.string().trim().min(2),
  locality: optionalTrimmedString,
  price: z.coerce.number().min(0),
  isActive: z.preprocess((value) => value === "true" || value === true || value === "1" || value === 1, z.boolean()).default(true),
  displayName: optionalTrimmedString,
}).strict();

const externalConfigSchema = z.object({
  instructions: optionalTrimmedString,
}).strict();

const pickupConfigSchema = z.object({
  instructions: optionalTrimmedString,
  pickupAddress: shippingAddressSchema.partial({
    recipientName: true,
    recipientPhone: true,
  }).optional(),
}).strict();

export const shippingMethodConfigSchema = z.union([
  externalConfigSchema,
  pickupConfigSchema,
]);

export const createShippingMethodSchema = z.object({
  name: z.string().trim().min(2),
  kind: z.nativeEnum(ShippingMethodKind),
  providerCode: z.nativeEnum(ShippingProviderCode),
  isActive: z.boolean().optional(),
  availableInCheckout: z.boolean().optional(),
  availableInAdmin: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  zoneRules: z.array(shippingZoneRuleSchema).max(200).optional(),
}).strict();

export const updateShippingMethodSchema = createShippingMethodSchema.partial().strict();

export const shippingQuoteRequestSchema = z.object({
  quoteType: z.nativeEnum(ShippingQuoteType),
  shippingAddress: shippingAddressSchema.optional(),
}).strict();

export const shippingSelectionSchema = z.object({
  shippingMethodId: z.string().cuid("Forma de envío inválida"),
  shippingQuoteId: z.string().cuid("Cotización inválida").optional(),
  shippingAddress: shippingAddressSchema.optional(),
  shippingSelectionType: z.nativeEnum(ShippingQuoteType),
}).strict();

export const shipmentStatusPatchSchema = z.object({
  isActive: z.boolean(),
}).strict();

export const shipmentActionResponseSchema = z.object({
  status: z.nativeEnum(OrderShipmentStatus),
}).strict();
