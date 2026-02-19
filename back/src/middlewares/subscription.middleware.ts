import type { Request, Response } from "express";
import { BillingStatus } from "@prisma/client";
import { env } from "../config/env";

const BILLING_BYPASS_PREFIXES = [
  "/api/public",
  "/api/payments/mercadopago/callback",
  "/api/payments/webhooks/mercadopago",
  "/api/payments/billing",
  "/api/superadmin"
];

const isBypassPath = (path: string) => {
  return BILLING_BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix));
};

export const ensureTenantHasActiveSubscription = (
  req: Request,
  res: Response,
  tenant: {
    billingStatus: BillingStatus;
    planEndsAt: Date | null;
  }
) => {
  if (isBypassPath(req.originalUrl)) {
    return true;
  }

  const status = tenant.billingStatus;
  if (status === BillingStatus.ACTIVE || status === BillingStatus.TRIALING) {
    return true;
  }

  if (status === BillingStatus.PAST_DUE) {
    if (env.BILLING_ALLOW_PAST_DUE) {
      return true;
    }
    return res.status(402).json({
      error: "Suscripción vencida. Regulariza el pago para continuar."
    });
  }

  if (status === BillingStatus.INACTIVE) {
    if (tenant.planEndsAt && Date.now() <= tenant.planEndsAt.getTime()) {
      return true;
    }
  }

  if (status === BillingStatus.CANCELED || status === BillingStatus.EXPIRED) {
    if (tenant.planEndsAt && Date.now() <= tenant.planEndsAt.getTime()) {
      return true;
    }
    return res.status(402).json({
      error: "Suscripción inactiva. Debes renovar para continuar."
    });
  }

  return res.status(402).json({
    error: "No tienes una suscripción activa."
  });
};
