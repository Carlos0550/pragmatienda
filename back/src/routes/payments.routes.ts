import { Router } from "express";
import { z } from "zod";

import { billingController } from "../controllers/billing.controller";
import { paymentsController } from "../controllers/payments.controller";
import { openApiRegistry } from "../docs/swagger";
import { requireIdempotencyKey, requireRole, requireTenant } from "../middlewares";

openApiRegistry.registerPath({
  method: "get",
  path: "/payments/mercadopago/connect/{storeId}",
  tags: ["Payments"],
  summary: "Iniciar conexión OAuth de Mercado Pago por tienda",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      Authorization: z.string(),
      "idempotency-key": z.string().min(8)
    }),
    params: z.object({
      storeId: z.string().cuid()
    })
  },
  responses: {
    "302": { description: "Redirección al OAuth de Mercado Pago" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/payments/mercadopago/callback",
  tags: ["Payments"],
  summary: "Callback OAuth de Mercado Pago",
  request: {
    query: z.object({
      code: z.string(),
      state: z.string()
    })
  },
  responses: {
    "302": { description: "Redirección al frontend" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/payments/checkout/{orderId}",
  tags: ["Payments"],
  summary: "Crear checkout de Mercado Pago para una orden",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      Authorization: z.string(),
      "idempotency-key": z.string().min(8)
    }),
    params: z.object({
      orderId: z.string().cuid()
    })
  },
  responses: {
    "200": { description: "Checkout creado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/payments/billing/subscriptions",
  tags: ["Billing"],
  summary: "Crear suscripción SaaS del tenant",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      Authorization: z.string(),
      "idempotency-key": z.string().min(8)
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            planId: z.string().cuid()
          })
        }
      }
    }
  },
  responses: {
    "201": { description: "Suscripción creada" }
  }
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/payments/billing/subscriptions/current/plan",
  tags: ["Billing"],
  summary: "Cambiar plan de la suscripción actual del tenant",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      Authorization: z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            planId: z.string().cuid()
          })
        }
      }
    }
  },
  responses: {
    "200": { description: "Plan actualizado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/payments/billing/subscriptions/current/resume",
  tags: ["Billing"],
  summary: "Reanudar la suscripción actual del tenant usando el mismo plan pago",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      Authorization: z.string()
    })
  },
  responses: {
    "200": { description: "Suscripción reanudada o reutilizada" },
    "201": { description: "Nueva suscripción creada para reanudar" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/payments/billing/sync",
  tags: ["Billing"],
  summary: "Ejecutar job manual de sincronización de suscripciones",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      Authorization: z.string()
    })
  },
  responses: {
    "200": { description: "Sync ejecutado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/payments/webhooks/mercadopago",
  tags: ["Payments"],
  summary: "Webhook de Mercado Pago",
  responses: {
    "200": { description: "Webhook procesado o ignorado" }
  }
});

const router = Router();

router.get(
  "/mercadopago/connect/:storeId",
  requireRole([1]),
  requireTenant,
  paymentsController.connectMercadoPago
);
router.get("/mercadopago/callback", paymentsController.callbackMercadoPago);
router.get(
  "/billing/subscriptions/current",
  requireRole([1]),
  requireTenant,
  billingController.getCurrentSubscription
);
router.get(
  "/billing/capabilities",
  requireRole([1]),
  requireTenant,
  billingController.getCapabilities
);
router.get(
  "/billing/plans",
  requireRole([1]),
  requireTenant,
  billingController.listPlansForBilling
);
router.post(
  "/checkout/:orderId",
  requireRole([1, 2]),
  requireTenant,
  requireIdempotencyKey("payments.checkout.mp"),
  paymentsController.createMercadoPagoCheckout
);
router.post(
  "/billing/subscriptions",
  requireRole([1]),
  requireTenant,
  requireIdempotencyKey("payments.billing.subscription.create"),
  billingController.createSubscription
);
router.patch(
  "/billing/subscriptions/current/plan",
  requireRole([1]),
  requireTenant,
  requireIdempotencyKey("payments.billing.subscription.change_plan"),
  billingController.changeSubscriptionPlan
);
router.post(
  "/billing/subscriptions/current/resume",
  requireRole([1]),
  requireTenant,
  billingController.resumeCurrentSubscription
);
router.post(
  "/billing/sync",
  requireRole([1]),
  requireTenant,
  billingController.syncSubscriptions
);
router.post("/webhooks/mercadopago", paymentsController.webhookMercadoPago);

export { router as paymentsRouter };
