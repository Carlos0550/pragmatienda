import { Router } from "express";
import { z } from "zod";
import { businessController } from "../controllers/business.controller";
import { openApiRegistry } from "../docs/swagger";
import { createBusinessTenantSchema, resolveTenantByStoreUrlSchema } from "../services/Business/business.zod";

openApiRegistry.registerPath({
  method: "post",
  path: "/platform/businesses",
  tags: ["Business"],
  summary: "Crear negocio en PragmaTienda",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createBusinessTenantSchema
        }
      }
    }
  },
  responses: {
    "201": {
      description: "Negocio y tenant creados"
    },
    "400": {
      description: "Datos invalidos"
    }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/public/tenant/resolve",
  tags: ["Business"],
  summary: "Resolver tenant por URL de tienda",
  request: {
    query: resolveTenantByStoreUrlSchema
  },
  responses: {
    "200": {
      description: "Tenant encontrado"
    },
    "400": {
      description: "URL invalida o dominio no permitido"
    },
    "404": {
      description: "No se encontro tenant para la tienda"
    }
  }
});

const router = Router();

router.post("/platform/businesses", businessController.createBusinessTenant);
router.get("/public/tenant/resolve", businessController.resolveTenantByStoreUrl);

export { router as businessRouter };
