import { Router } from "express";
import { z } from "zod";
import { businessController } from "../controllers/business.controller";
import { openApiRegistry } from "../docs/swagger";
import { createBusinessTenantSchema, loginBusinessSchema, resolveTenantByStoreUrlSchema } from "../services/Business/business.zod";
import { requireRole, requireTenant, uploadBusinessAssetsMiddleware } from "../middlewares";
import { changePasswordSchema, recoverPasswordSchema } from "../services/Users/user.zod";

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

openApiRegistry.registerPath({
  method: "put",
  path: "/platform/businesses/manage",
  tags: ["Business"],
  summary: "Actualizar datos del negocio del tenant",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().optional(),
            website: z.string().optional(),
            socialMedia: z.string().optional().openapi({
              description: "JSON serializado de redes sociales"
            }),
            logo: z.any().optional().openapi({ type: "string", format: "binary" }),
            banner: z.any().optional().openapi({ type: "string", format: "binary" }),
            favicon: z.any().optional().openapi({ type: "string", format: "binary" })
          })
        }
      }
    }
  },
  responses: {
    "200": {
      description: "Negocio actualizado correctamente"
    },
    "400": {
      description: "Datos invalidos"
    },
    "401": {
      description: "No autorizado"
    },
    "403": {
      description: "Sin permisos"
    },
    "404": {
      description: "Tenant no encontrado"
    }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/platform/businesses/login",
  tags: ["Business"],
  summary: "Inicio de sesión de administrador de negocio",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: loginBusinessSchema
        }
      }
    }
  },
  responses: {
    "200": {
      description: "Inicio de sesión exitoso"
    }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/platform/businesses/password/recovery",
  tags: ["Business"],
  summary: "Recuperar contraseña de administrador de negocio",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: recoverPasswordSchema
        }
      }
    }
  },
  responses: {
    "200": {
      description: "Si el correo existe, se enviaron instrucciones"
    }
  }
});

openApiRegistry.registerPath({
  method: "put",
  path: "/platform/businesses/me/password",
  tags: ["Business"],
  summary: "Cambiar contraseña del administrador autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      "Authorization": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: changePasswordSchema
        }
      }
    }
  },
  responses: {
    "200": {
      description: "Contraseña actualizada correctamente"
    }
  }
});

const router = Router();

router.get("/public/tenant/resolve", businessController.resolveTenantByStoreUrl);
router.post("/platform/businesses", businessController.createBusinessTenant);
router.post("/platform/businesses/login",requireTenant, businessController.loginBusiness);
router.post("/platform/businesses/password/recovery", requireTenant, businessController.recoverPasswordBusiness);
router.put("/platform/businesses/me/password", requireRole([1]), requireTenant, businessController.changePasswordBusiness);
router.put("/platform/businesses/manage", requireTenant, requireRole([1]), uploadBusinessAssetsMiddleware, businessController.manageBusiness)

export { router as businessRouter };
