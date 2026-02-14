import { z } from "zod";

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  name: z.string().trim().optional()
}).strict();

export const createCategorySchema = z.object({
  name: z.string().min(1, "Nombre requerido").trim(),
  description: z.string().optional()
}).strict();

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
}).strict();
