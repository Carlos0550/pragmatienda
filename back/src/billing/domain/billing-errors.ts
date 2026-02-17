export type BillingErrorCode =
  | "CONFIG_ERROR"
  | "TENANT_NOT_FOUND"
  | "PLAN_NOT_FOUND"
  | "PLAN_INACTIVE"
  | "PLAN_UNAVAILABLE"
  | "SUBSCRIPTION_NOT_FOUND"
  | "PROVIDER_ERROR"
  | "INVALID_WEBHOOK"
  | "ACCESS_DENIED";

export class BillingError extends Error {
  status: number;
  code: BillingErrorCode;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: BillingErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
