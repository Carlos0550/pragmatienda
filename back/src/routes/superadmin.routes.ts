import { Router } from "express";
import { z } from "zod";
import { PlanType } from "@prisma/client";
import { requireSuperAdmin } from "../middlewares";
import { superadminController } from "../controllers/superadmin.controller";
import { openApiRegistry } from "../docs/swagger";

openApiRegistry.registerPath({
  method: "get",
  path: "/superadmin/plans",
  tags: ["Superadmin"],
  summary: "Listar todos los planes (incluye inactivos)",
  request: {
    headers: z.object({
      Authorization: z.string()
    })
  },
  responses: {
    "200": { description: "Lista de planes" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/superadmin/plans/{id}",
  tags: ["Superadmin"],
  summary: "Obtener un plan por id",
  request: {
    headers: z.object({
      Authorization: z.string()
    }),
    params: z.object({
      id: z.string().cuid()
    })
  },
  responses: {
    "200": { description: "Plan encontrado" },
    "404": { description: "Plan no encontrado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/superadmin/plans",
  tags: ["Superadmin"],
  summary: "Crear plan",
  request: {
    headers: z.object({
      Authorization: z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.nativeEnum(PlanType),
            name: z.string(),
            description: z.string().optional(),
            price: z.number(),
            currency: z.string().default("ARS"),
            interval: z.string().default("month"),
            trialDays: z.number().default(0)
          })
        }
      }
    }
  },
  responses: {
    "201": { description: "Plan creado" },
    "400": { description: "Datos inválidos" },
    "409": { description: "Plan con ese código ya existe" }
  }
});

openApiRegistry.registerPath({
  method: "put",
  path: "/superadmin/plans/{id}",
  tags: ["Superadmin"],
  summary: "Actualizar plan",
  request: {
    headers: z.object({
      Authorization: z.string()
    }),
    params: z.object({
      id: z.string().cuid()
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            price: z.number().optional(),
            currency: z.string().optional(),
            interval: z.string().optional(),
            trialDays: z.number().optional(),
            active: z.boolean().optional()
          })
        }
      }
    }
  },
  responses: {
    "200": { description: "Plan actualizado" },
    "400": { description: "Datos inválidos" },
    "404": { description: "Plan no encontrado" }
  }
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/superadmin/plans/{id}",
  tags: ["Superadmin"],
  summary: "Desactivar plan (soft delete)",
  request: {
    headers: z.object({
      Authorization: z.string()
    }),
    params: z.object({
      id: z.string().cuid()
    })
  },
  responses: {
    "200": { description: "Plan desactivado" },
    "400": { description: "Plan tiene suscripciones activas" },
    "404": { description: "Plan no encontrado" }
  }
});

const router = Router();

router.get("/plans", requireSuperAdmin, superadminController.listPlans);
router.get("/plans/:id", requireSuperAdmin, superadminController.getPlanById);
router.post("/plans", requireSuperAdmin, superadminController.createPlan);
router.put("/plans/:id", requireSuperAdmin, superadminController.updatePlan);
router.delete("/plans/:id", requireSuperAdmin, superadminController.deletePlan);

export { router as superadminRouter };
