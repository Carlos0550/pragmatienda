import { Router } from "express";
import { z } from "zod";
import { businessController } from "../controllers/business.controller";
import { productsController } from "../controllers/products.controller";
import { userController } from "../controllers/user.controller";
import { openApiRegistry } from "../docs/swagger";
import { requireTenant } from "../middlewares";
import {
  createBusinessTenantSchema,
  loginBusinessSchema,
  resolveTenantByStoreUrlSchema
} from "../services/Business/business.zod";
import { listProductsQuerySchema } from "../services/Products/products.zod";
import {
  loginSchema,
  publicRegisterUserSchema,
  recoverPasswordSchema
} from "../services/Users/user.zod";

const healthResponseSchema = z
  .object({
    status: z.string().openapi({ example: "ok" })
  })
  .openapi("HealthResponse");

openApiRegistry.register("HealthResponse", healthResponseSchema);

// Health
openApiRegistry.registerPath({
  method: "get",
  path: "/public/health",
  tags: ["Health"],
  summary: "Health check",
  responses: {
    "200": {
      description: "OK",
      content: {
        "application/json": {
          schema: healthResponseSchema
        }
      }
    }
  }
});

// Platform / Business
openApiRegistry.registerPath({
  method: "post",
  path: "/public/platform/businesses",
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
    "201": { description: "Negocio y tenant creados" },
    "400": { description: "Datos invalidos" }
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
    "200": { description: "Tenant encontrado" },
    "400": { description: "URL invalida o dominio no permitido" },
    "404": { description: "No se encontro tenant para la tienda" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/public/products",
  tags: ["Products"],
  summary: "Listar productos públicos de la tienda",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    query: listProductsQuerySchema
  },
  responses: {
    "200": { description: "Lista de productos" },
    "400": { description: "Tenant requerido o datos inválidos" }
  }
});

// User - público
openApiRegistry.registerPath({
  method: "post",
  path: "/public/register",
  tags: ["User"],
  summary: "Registro publico de usuario",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "application/json": {
          schema: publicRegisterUserSchema
        }
      }
    }
  },
  responses: {}
});

openApiRegistry.registerPath({
  method: "post",
  path: "/public/login",
  tags: ["User"],
  summary: "Inicio de sesion publico",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "application/json": {
          schema: loginSchema
        }
      }
    }
  },
  responses: {}
});

openApiRegistry.registerPath({
  method: "post",
  path: "/public/password/recovery",
  tags: ["User"],
  summary: "Recuperar contraseña por correo",
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
  responses: {}
});

openApiRegistry.registerPath({
  method: "get",
  path: "/public/verify",
  tags: ["User"],
  summary: "Verificar cuenta de usuario",
  responses: {}
});

// Admin - público (login y recovery sin auth)
openApiRegistry.registerPath({
  method: "post",
  path: "/public/admin/login",
  tags: ["Business"],
  summary: "Inicio de sesión de administrador de negocio",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "application/json": {
          schema: loginBusinessSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Inicio de sesión exitoso" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/public/admin/password/recovery",
  tags: ["Business"],
  summary: "Recuperar contraseña de administrador de negocio",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "application/json": {
          schema: recoverPasswordSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Si el correo existe, se enviaron instrucciones" }
  }
});

const router = Router();

// Health
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Platform / Business
router.get("/tenant/resolve", businessController.resolveTenantByStoreUrl);
router.get(
  "/products",
  requireTenant,
  (req, _res, next) => {
    (req as { productsRequestIsPublic?: boolean }).productsRequestIsPublic = true;
    next();
  },
  productsController.getMany
);
router.post("/platform/businesses", businessController.createBusinessTenant);

// User - público
router.post("/register", requireTenant, userController.publicRegisterUser);
router.post("/login", requireTenant, userController.login);
router.post("/password/recovery", requireTenant, userController.recoverPassword);
router.get("/verify", userController.verifyAccount);

// Admin - público
router.post("/admin/login", requireTenant, businessController.loginBusiness);
router.post("/admin/password/recovery", requireTenant, businessController.recoverPasswordBusiness);

export { router as publicRouter };
