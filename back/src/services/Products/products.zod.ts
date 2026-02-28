import { z } from "zod";
import { ProductsStatus } from "@prisma/client";
import { metadataSchema } from "../SEO/seo.zod";

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  name: z.string().trim().optional(),
  categoryId: z.string().cuid().optional(),
  categorySlug: z.string().trim().min(1).optional(),
  status: z.nativeEnum(ProductsStatus).optional(),
  sortBy: z.enum(["price", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
}).strict();

export const createProductSchema = z.object({
  name: z.string().min(1, "Nombre requerido").trim(),
  description: z.string().optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(255).optional(),
  price: z.coerce.number().positive("Precio debe ser positivo"),
  stock: z.coerce.number().int().min(0, "Stock no puede ser negativo"),
  categoryId: z.string().cuid().optional().nullable(),
  metadata: metadataSchema.optional(),
  status: z.nativeEnum(ProductsStatus).optional()
}).strict();

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  metaTitle: z.string().max(120).optional(),
  metaDescription: z.string().max(255).optional(),
  price: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  categoryId: z.string().cuid().optional().nullable(),
  metadata: metadataSchema.optional(),
  status: z.nativeEnum(ProductsStatus).optional()
}).strict();

export const patchBulkStatusSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "Al menos un id requerido"),
  status: z.nativeEnum(ProductsStatus)
}).strict();

export const deleteBulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "Al menos un id requerido")
}).strict();
