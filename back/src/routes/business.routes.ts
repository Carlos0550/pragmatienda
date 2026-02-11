import { Router } from "express";
import { z } from "zod";
import { businessController } from "../controllers/business.controller";
import { openApiRegistry } from "../docs/swagger";
import { createBusinessTenantSchema } from "../services/Business/business.zod";

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

const router = Router();

router.post("/platform/businesses", businessController.createBusinessTenant);

export { router as businessRouter };
