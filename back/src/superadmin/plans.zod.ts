import { z } from "zod";
import { PlanType } from "@prisma/client";

export const createPlanSchema = z.object({
  code: z.nativeEnum(PlanType),
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  currency: z.string().min(1).default("ARS"),
  interval: z.string().min(1).default("month"),
  trialDays: z.number().int().min(0).default(0)
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  interval: z.string().min(1).optional(),
  trialDays: z.number().int().min(0).optional(),
  active: z.boolean().optional()
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
