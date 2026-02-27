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
      Authorization: z.string()
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
  requireTenant,
  requireRole([1]),
  paymentsController.connectMercadoPago
);
router.get("/mercadopago/callback", paymentsController.callbackMercadoPago);
router.get(
  "/billing/subscriptions/current",
  requireTenant,
  requireRole([1]),
  billingController.getCurrentSubscription
);
router.get(
  "/billing/plans",
  requireTenant,
  requireRole([1]),
  billingController.listPlansForBilling
);
router.post(
  "/checkout/:orderId",
  requireTenant,
  requireRole([1, 2]),
  requireIdempotencyKey("payments.checkout.mp"),
  paymentsController.createMercadoPagoCheckout
);
router.post(
  "/billing/subscriptions",
  requireTenant,
  requireRole([1]),
  billingController.createSubscription
);
router.patch(
  "/billing/subscriptions/current/plan",
  requireTenant,
  requireRole([1]),
  billingController.changeSubscriptionPlan
);
router.post(
  "/billing/sync",
  requireTenant,
  requireRole([1]),
  billingController.syncSubscriptions
);
router.post("/webhooks/mercadopago", paymentsController.webhookMercadoPago);

export { router as paymentsRouter };
