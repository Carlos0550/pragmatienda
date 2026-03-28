import { z } from "zod";
import { shippingSelectionSchema } from "../Shipping/shipping.zod";

export const patchCartItemsSchema = z.object({
  productId: z.string().cuid("productId inválido"),
  delta: z.number().int("delta debe ser un número entero")
}).strict();

export const deleteCartItemsSchema = z.object({
  productIds: z.array(z.string().cuid()).optional()
}).strict();

export const checkoutOriginSchema = z.enum(["cart", "sale"]);

const optionalPhone = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().min(10).max(20).optional()
);

const booleanFromForm = z.preprocess((value) => {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0 || value === "" || value == null) return false;
  return value;
}, z.boolean());

export const guestCheckoutDetailsSchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
  phone: optionalPhone,
  createAccountAfterPurchase: booleanFromForm.default(false)
}).strict();

export const cartCheckoutSchema = z.object({
  origin: checkoutOriginSchema,
  paymentProvider: z.string().optional(),
  name: guestCheckoutDetailsSchema.shape.name,
  email: guestCheckoutDetailsSchema.shape.email,
  phone: guestCheckoutDetailsSchema.shape.phone,
  createAccountAfterPurchase: guestCheckoutDetailsSchema.shape.createAccountAfterPurchase,
  shippingMethodId: shippingSelectionSchema.shape.shippingMethodId.optional(),
  shippingQuoteId: shippingSelectionSchema.shape.shippingQuoteId.optional(),
  shippingSelectionType: shippingSelectionSchema.shape.shippingSelectionType.optional(),
  shippingAddress: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    if (!value.trim()) return undefined;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }, shippingSelectionSchema.shape.shippingAddress.optional()),
}).strict();
