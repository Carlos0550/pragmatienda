import { MercadoPagoConfig, PreApproval, PreApprovalPlan } from "mercadopago";
import { env } from "../../config/env";
import { BillingError } from "../domain/billing-errors";
import type {
  BillingPlanInput,
  BillingProvider,
  BillingSubscriptionInput,
  BillingSubscriptionResponse,
  BillingSubscriptionSnapshot
} from "../domain/billing-provider";

const toDate = (value: string | number | undefined) => {
  if (!value) return null;
  const date = new Date(typeof value === "number" ? value : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return Number(value.toString());
  }
  return Number(value ?? 0);
};

const toJsonRecord = (value: unknown) =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

export class MercadoPagoBillingProvider implements BillingProvider {
  private getConfig() {
    if (!env.MP_BILLING_ACCESS_TOKEN) {
      throw new BillingError(
        500,
        "CONFIG_ERROR",
        "MP_BILLING_ACCESS_TOKEN es requerido para billing."
      );
    }
    return new MercadoPagoConfig({
      accessToken: env.MP_BILLING_ACCESS_TOKEN
    });
  }

  async ensurePreapprovalPlan(plan: BillingPlanInput): Promise<{ preapprovalPlanId: string | null }> {
    if (plan.amount <= 0) {
      return { preapprovalPlanId: null };
    }
    if (plan.mpPreapprovalPlanId) {
      return { preapprovalPlanId: plan.mpPreapprovalPlanId };
    }

    const preApprovalPlan = new PreApprovalPlan(this.getConfig());
    const interval = plan.interval.toLowerCase();
    const frequencyType = interval === "year" ? "months" : "months";
    const frequency = interval === "year" ? 12 : 1;

    const reasonPrefix = env.MP_BILLING_REASON_PREFIX || "Pragmatienda";
    const reason = `${reasonPrefix} - ${plan.name}`;
    const created = await preApprovalPlan.create({
      body: {
        reason,
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: plan.amount,
          currency_id: plan.currency
        },
        back_url: env.MP_BILLING_SUCCESS_URL ?? env.FRONTEND_URL
      }
    });

    if (!created.id) {
      throw new BillingError(502, "PROVIDER_ERROR", "No se pudo crear preapproval_plan en MP.");
    }

    return { preapprovalPlanId: created.id };
  }

  async updatePreapprovalPlan(
    preapprovalPlanId: string,
    plan: BillingPlanInput
  ): Promise<void> {
    if (plan.amount <= 0) {
      return;
    }
    const preApprovalPlan = new PreApprovalPlan(this.getConfig());
    const interval = plan.interval.toLowerCase();
    const frequencyType = interval === "year" ? "months" : "months";
    const frequency = interval === "year" ? 12 : 1;
    const reasonPrefix = env.MP_BILLING_REASON_PREFIX || "Pragmatienda";
    const reason = `${reasonPrefix} - ${plan.name}`;
    await preApprovalPlan.update({
      id: preapprovalPlanId,
      updatePreApprovalPlanRequest: {
        reason,
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: plan.amount,
          currency_id: plan.currency
        },
        back_url: env.MP_BILLING_SUCCESS_URL ?? env.FRONTEND_URL
      }
    });
  }

  async createSubscription(input: BillingSubscriptionInput): Promise<BillingSubscriptionResponse> {
    if (input.preapprovalPlanId) {
      return this.createSubscriptionFromPlan(input);
    }

    const preApproval = new PreApproval(this.getConfig());
    const reasonPrefix = env.MP_BILLING_REASON_PREFIX || "Pragmatienda";
    const body: Parameters<PreApproval["create"]>[0]["body"] = {
      reason: `${reasonPrefix} - ${input.planName}`,
      external_reference: input.tenantId,
      payer_email: input.ownerEmail,
      back_url: env.MP_BILLING_SUCCESS_URL ?? env.FRONTEND_URL,
      status: "pending"
    };

    body.auto_recurring = {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: input.amount,
      currency_id: input.currency
    };

    const created = await preApproval.create({
      body
    });

    if (!created.id) {
      throw new BillingError(502, "PROVIDER_ERROR", "No se pudo crear la suscripción en Mercado Pago.");
    }

    return {
      externalSubscriptionId: created.id,
      status: created.status ?? "pending",
      initPoint: created.init_point ?? null,
      currentPeriodStart: null,
      currentPeriodEnd: toDate(created.next_payment_date)
    };
  }

  /**
   * Flujo alternativo: cuando hay plan, MP exige card_token_id para PreApproval.create().
   * En su lugar, usamos el init_point del plan para redirigir al checkout de MP.
   * La suscripción se crea cuando el usuario completa el pago; el webhook la procesará.
   */
  private async createSubscriptionFromPlan(
    input: BillingSubscriptionInput
  ): Promise<BillingSubscriptionResponse> {
    const preApprovalPlan = new PreApprovalPlan(this.getConfig());
    const plan = await preApprovalPlan.get({
      preApprovalPlanId: input.preapprovalPlanId!
    });

    const baseUrl = plan.init_point ?? `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${input.preapprovalPlanId}`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    let initPoint = `${baseUrl}${separator}external_reference=${encodeURIComponent(input.tenantId)}&payer_email=${encodeURIComponent(input.ownerEmail)}`;
    if (input.storeSuccessUrl) {
      initPoint += `&back_url=${encodeURIComponent(input.storeSuccessUrl)}`;
    }

    return {
      externalSubscriptionId: "",
      status: "pending",
      initPoint,
      currentPeriodStart: null,
      currentPeriodEnd: null
    };
  }

  async getSubscription(externalSubscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    const preApproval = new PreApproval(this.getConfig());
    const data = await preApproval.get({
      id: externalSubscriptionId
    });

    return {
      externalSubscriptionId: data.id ?? externalSubscriptionId,
      externalReference: data.external_reference ?? null,
      payerEmail: (data as { payer_email?: string }).payer_email ?? null,
      preapprovalPlanId: (data as { preapproval_plan_id?: string }).preapproval_plan_id ?? null,
      status: data.status ?? "pending",
      reason: data.reason ?? null,
      currentPeriodStart: toDate(data.date_created),
      currentPeriodEnd: toDate(data.next_payment_date),
      autoRecurringAmount: toNumber(data.auto_recurring?.transaction_amount),
      autoRecurringCurrency: data.auto_recurring?.currency_id ?? null,
      cancelAtPeriodEnd: data.status === "cancelled",
      raw: toJsonRecord(data)
    };
  }

  async changeSubscriptionPlanAmount(
    externalSubscriptionId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const preApproval = new PreApproval(this.getConfig());
    await preApproval.update({
      id: externalSubscriptionId,
      body: {
        auto_recurring: {
          transaction_amount: amount,
          currency_id: currency
        }
      }
    });
  }

  async searchSubscriptionsByStatus(status: "authorized" | "pending") {
    const preApproval = new PreApproval(this.getConfig());
    const result = await preApproval.search({
      options: {
        status
      }
    });

    const rows = result.results ?? [];
    return rows
      .filter((row) => Boolean(row.id))
      .map((row) => ({
        externalSubscriptionId: row.id as string,
        externalReference: row.external_reference ?? null,
        payerEmail: (row as { payer_email?: string }).payer_email ?? null,
        preapprovalPlanId: (row as { preapproval_plan_id?: string }).preapproval_plan_id ?? null,
        status: row.status ?? "pending",
        reason: row.reason ?? null,
        currentPeriodStart: toDate(row.date_created),
        currentPeriodEnd: toDate(row.next_payment_date),
        autoRecurringAmount: toNumber(row.auto_recurring?.transaction_amount),
        autoRecurringCurrency: row.auto_recurring?.currency_id ?? null,
        cancelAtPeriodEnd: row.status === "cancelled",
        raw: toJsonRecord(row)
      })) as BillingSubscriptionSnapshot[];
  }
}
