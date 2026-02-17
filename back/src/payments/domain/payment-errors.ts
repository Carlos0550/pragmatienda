export type PaymentErrorCode =
  | "CONFIG_ERROR"
  | "ACCOUNT_NOT_CONNECTED"
  | "INVALID_STATE"
  | "UNAUTHORIZED_STORE_CONTEXT"
  | "ORDER_NOT_FOUND"
  | "INVALID_WEBHOOK"
  | "PROVIDER_ERROR";

export class PaymentError extends Error {
  status: number;
  code: PaymentErrorCode;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: PaymentErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
