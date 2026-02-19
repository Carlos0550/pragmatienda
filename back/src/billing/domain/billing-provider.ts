import { PlanType } from "@prisma/client";

export type BillingPlanInput = {
  code: PlanType;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  interval: string;
  trialDays: number;
  mpPreapprovalPlanId?: string | null;
};

export type BillingSubscriptionInput = {
  tenantId: string;
  ownerEmail: string;
  planCode: PlanType;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  trialDays: number;
  preapprovalPlanId?: string | null;
  /** URL de la tienda para redirigir tras completar el pago (ej: https://mitienda.pragmatienda.com/admin/billing) */
  storeSuccessUrl?: string | null;
};

export type BillingSubscriptionResponse = {
  externalSubscriptionId: string;
  status: string;
  initPoint?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
};

export type BillingSubscriptionSnapshot = {
  externalSubscriptionId: string;
  externalReference: string | null;
  payerEmail?: string | null;
  preapprovalPlanId?: string | null;
  status: string;
  reason?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  autoRecurringAmount?: number | null;
  autoRecurringCurrency?: string | null;
  cancelAtPeriodEnd?: boolean;
  raw: Record<string, unknown>;
};

export interface BillingProvider {
  ensurePreapprovalPlan(plan: BillingPlanInput): Promise<{ preapprovalPlanId: string | null }>;
  updatePreapprovalPlan(preapprovalPlanId: string, plan: BillingPlanInput): Promise<void>;
  createSubscription(input: BillingSubscriptionInput): Promise<BillingSubscriptionResponse>;
  getSubscription(externalSubscriptionId: string): Promise<BillingSubscriptionSnapshot>;
  changeSubscriptionPlanAmount(
    externalSubscriptionId: string,
    amount: number,
    currency: string
  ): Promise<void>;
  searchSubscriptionsByStatus(status: "authorized" | "pending"): Promise<BillingSubscriptionSnapshot[]>;
}
