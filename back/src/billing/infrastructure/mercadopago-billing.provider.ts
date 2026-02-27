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

const isPayerCollectorModeMismatch = (message: string) =>
  message.toLowerCase().includes("payer and collector") &&
  message.toLowerCase().includes("real or test users");

type PreApprovalCreateBody = Parameters<PreApproval["create"]>[0]["body"];

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
    const backUrl = input.storeSuccessUrl || env.MP_BILLING_SUCCESS_URL || env.FRONTEND_URL;
    const body: PreApprovalCreateBody = {
      reason: `${reasonPrefix} - ${input.planName}`,
      external_reference: input.tenantId,
      payer_email: input.ownerEmail,
      back_url: backUrl,
      status: "pending"
    };

    body.auto_recurring = {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: input.amount,
      currency_id: input.currency
    };

    const created = await this.createPreApprovalWithFallback(preApproval, body);

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
   * MP exige card_token_id para PreApproval.create() con preapproval_plan_id,
   * así que creamos una PreApproval standalone con los mismos términos del plan.
   * Esto permite setear external_reference y payer_email correctamente.
   */
  private async createSubscriptionFromPlan(
    input: BillingSubscriptionInput
  ): Promise<BillingSubscriptionResponse> {
    const preApproval = new PreApproval(this.getConfig());
    const backUrl = input.storeSuccessUrl || env.MP_BILLING_SUCCESS_URL || env.FRONTEND_URL;
    const reasonPrefix = env.MP_BILLING_REASON_PREFIX || "Pragmatienda";

    const interval = input.interval.toLowerCase();
    const frequency = interval === "year" ? 12 : 1;

    const body: PreApprovalCreateBody = {
      reason: `${reasonPrefix} - ${input.planName}`,
      external_reference: input.tenantId,
      payer_email: input.ownerEmail,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency,
        frequency_type: "months",
        transaction_amount: input.amount,
        currency_id: input.currency
      }
    };

    const created = await this.createPreApprovalWithFallback(preApproval, body);

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

  private async createPreApprovalWithFallback(
    preApproval: PreApproval,
    body: PreApprovalCreateBody
  ) {
    try {
      return await preApproval.create({ body });
    } catch (error) {
      const message = this.getErrorMessage(error);
      const hasPayerEmail = Object.prototype.hasOwnProperty.call(body, "payer_email");
      const shouldRetryWithoutPayerEmail =
        hasPayerEmail && isPayerCollectorModeMismatch(message);

      if (!shouldRetryWithoutPayerEmail) {
        throw this.toProviderError(error);
      }

      // Fallback: dejamos que MP pida el login en checkout sin forzar payer_email.
      const bodyWithoutPayer = { ...(body as PreApprovalCreateBody & { payer_email?: string }) };
      delete bodyWithoutPayer.payer_email;

      try {
        return await preApproval.create({ body: bodyWithoutPayer as PreApprovalCreateBody });
      } catch (retryError) {
        const retryMessage = this.getErrorMessage(retryError).toLowerCase();
        if (retryMessage.includes("payer_email") && retryMessage.includes("required")) {
          // Si MP exige payer_email, priorizamos informar el error original de incompatibilidad real/test.
          throw this.toProviderError(error);
        }
        throw this.toProviderError(retryError);
      }
    }
  }

  private toProviderError(error: unknown): BillingError {
    if (error instanceof BillingError) return error;
    const message = this.getErrorMessage(error);
    const status = this.getErrorStatus(error);
    if (isPayerCollectorModeMismatch(message)) {
      return new BillingError(
        400,
        "PROVIDER_ERROR",
        "Mercado Pago rechazó el payer_email: cobrador y pagador deben ser ambos reales o ambos de prueba.",
        { providerMessage: message }
      );
    }
    return new BillingError(
      status && status >= 400 && status < 600 ? status : 502,
      "PROVIDER_ERROR",
      message || "Error al crear la suscripción en Mercado Pago."
    );
  }

  private getErrorStatus(error: unknown): number | null {
    const obj = this.toRecord(error);
    const directStatus = this.toNumberSafe(obj?.status);
    if (directStatus) return directStatus;

    const directStatusCode = this.toNumberSafe(obj?.statusCode);
    if (directStatusCode) return directStatusCode;

    const response = this.toRecord(obj?.response);
    const responseStatus = this.toNumberSafe(response?.status);
    if (responseStatus) return responseStatus;

    return null;
  }

  private getErrorMessage(error: unknown): string {
    const parts: string[] = [];

    if (typeof error === "string") {
      parts.push(error);
    } else if (error instanceof Error && error.message) {
      parts.push(error.message);
    }

    const obj = this.toRecord(error);
    this.pushStringIfAny(parts, obj?.message);
    this.pushStringIfAny(parts, obj?.error);
    this.pushStringIfAny(parts, obj?.description);

    const response = this.toRecord(obj?.response);
    const responseData = this.toRecord(response?.data);
    this.pushStringIfAny(parts, responseData?.message);
    this.pushStringIfAny(parts, responseData?.error);

    this.pushCauseDescriptions(parts, obj?.cause);
    this.pushCauseDescriptions(parts, responseData?.cause);

    const compact = parts
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part, index, arr) => arr.indexOf(part) === index);

    if (compact.length > 0) return compact.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return "Error desconocido del proveedor de billing.";
    }
  }

  private pushCauseDescriptions(parts: string[], cause: unknown) {
    if (!cause) return;
    if (Array.isArray(cause)) {
      for (const item of cause) {
        const obj = this.toRecord(item);
        this.pushStringIfAny(parts, obj?.description);
        this.pushStringIfAny(parts, obj?.code);
        this.pushStringIfAny(parts, obj?.message);
      }
      return;
    }
    const obj = this.toRecord(cause);
    this.pushStringIfAny(parts, obj?.description);
    this.pushStringIfAny(parts, obj?.code);
    this.pushStringIfAny(parts, obj?.message);
  }

  private pushStringIfAny(parts: string[], value: unknown) {
    if (typeof value === "string" && value.trim()) {
      parts.push(value);
    }
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object") return null;
    return value as Record<string, unknown>;
  }

  private toNumberSafe(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
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
