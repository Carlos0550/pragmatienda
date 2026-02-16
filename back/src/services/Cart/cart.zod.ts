import { z } from "zod";

export const patchCartItemsSchema = z.object({
  productId: z.string().cuid("productId inválido"),
  delta: z.number().int("delta debe ser un número entero")
}).strict();

export const deleteCartItemsSchema = z.object({
  productIds: z.array(z.string().cuid()).optional()
}).strict();
