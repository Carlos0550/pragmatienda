import type { PlanType } from "@prisma/client";

/** Límites y flags efectivos del plan del tenant. */
export interface PlanCapabilities {
  planCode: PlanType;
  planId: string;
  maxProducts: number | null;
  maxCategories: number | null;
  features: Record<string, boolean>;
}

/** Uso actual del tenant (conteos). */
export interface PlanUsage {
  productsCount: number;
  categoriesCount: number;
}

/** Capacidades + uso actual para exponer en API. */
export interface TenantCapabilitiesResponse extends PlanCapabilities {
  usage: PlanUsage;
}
