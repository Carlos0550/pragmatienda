import { BillingStatus } from "@prisma/client";

export const mapMercadoPagoPreapprovalStatus = (
  status: string | undefined
): BillingStatus => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "authorized") return BillingStatus.ACTIVE;
  if (normalized === "pending") return BillingStatus.TRIALING;
  if (normalized === "paused") return BillingStatus.PAST_DUE;
  if (normalized === "cancelled") return BillingStatus.CANCELED;
  if (normalized === "expired") return BillingStatus.EXPIRED;
  return BillingStatus.INACTIVE;
};
