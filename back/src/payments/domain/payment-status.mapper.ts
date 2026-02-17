import { PaymentStatus } from "@prisma/client";

export const mapMercadoPagoStatusToOrderPaymentStatus = (
  status: string | undefined
): PaymentStatus => {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "approved") {
    return PaymentStatus.PAID;
  }
  if (normalized === "rejected") {
    return PaymentStatus.FAILED;
  }
  if (normalized === "cancelled" || normalized === "cancelled_by_user") {
    return PaymentStatus.CANCELED;
  }
  if (normalized === "refunded" || normalized === "charged_back") {
    return PaymentStatus.REFUNDED;
  }
  if (normalized === "authorized") {
    return PaymentStatus.AUTHORIZED;
  }
  if (normalized === "in_process") {
    return PaymentStatus.REQUIRES_ACTION;
  }
  if (normalized === "expired") {
    return PaymentStatus.EXPIRED;
  }

  return PaymentStatus.PENDING;
};

export const mapMercadoPagoStatusToPublicPaymentStatus = (
  status: string | undefined
): "pending" | "approved" | "rejected" | "cancelled" | "refunded" => {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "cancelled" || normalized === "cancelled_by_user") return "cancelled";
  if (normalized === "refunded" || normalized === "charged_back") return "refunded";
  return "pending";
};
