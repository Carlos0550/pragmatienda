import { z } from "zod";

const paymentStatusEnum = z.enum([
  "PENDING", "REQUIRES_ACTION", "AUTHORIZED", "PAID", "FAILED", "REFUNDED",
  "PARTIALLY_REFUNDED", "CANCELED", "EXPIRED"
]);

export const listSalesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    from: z.string().optional(),
    to: z.string().optional(),
    sortBy: z.enum(["saleDate", "total", "createdAt"]).default("saleDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .strict();

export const updateSaleSchema = z
  .object({
    discount: z.number().min(0).optional(),
    status: paymentStatusEnum.optional()
  })
  .strict();

export const patchSaleItemsSchema = z
  .object({
    removeItemIds: z.array(z.string().cuid()).optional(),
    replaceItems: z
      .array(
        z.object({
          orderItemId: z.string().cuid(),
          productId: z.string().cuid(),
          quantity: z.number().int().min(1)
        })
      )
      .optional()
  })
  .strict()
  .refine(
    (d) => (d.removeItemIds?.length ?? 0) > 0 || (d.replaceItems?.length ?? 0) > 0,
    { message: "Debe indicar items a eliminar o reemplazar." }
  );
