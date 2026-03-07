import { z } from "zod";
import { PlanType } from "@prisma/client";

/** Features por plan: claves conocidas y boolean. Otras claves se permiten para extensibilidad. */
export const planFeaturesSchema = z
  .record(z.string(), z.boolean())
  .optional()
  .nullable();

export const createPlanSchema = z.object({
  code: z.nativeEnum(PlanType),
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  currency: z.string().min(1).default("ARS"),
  interval: z.string().min(1).default("month"),
  trialDays: z.number().int().min(0).default(0),
  maxProducts: z.number().int().min(0).nullable().optional(),
  maxCategories: z.number().int().min(0).nullable().optional(),
  features: planFeaturesSchema
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  interval: z.string().min(1).optional(),
  trialDays: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  maxProducts: z.number().int().min(0).nullable().optional(),
  maxCategories: z.number().int().min(0).nullable().optional(),
  features: planFeaturesSchema
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;
