import { Router } from "express";
import { z } from "zod";
import { businessController } from "../controllers/business.controller";
import { categoriesController } from "../controllers/categories.controller";
import { paymentsController } from "../controllers/payments.controller";
import { productsController } from "../controllers/products.controller";
import { openApiRegistry } from "../docs/swagger";
import {
  requireRole,
  requireTenant,
  uploadAndConvertImageOptionalMiddleware,
  uploadBusinessAssetsMiddleware
} from "../middlewares";
import { changePasswordSchema } from "../services/Users/user.zod";
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema
} from "../services/Categories/categories.zod";
import {
  createProductSchema,
  updateProductSchema,
  patchBulkStatusSchema,
  deleteBulkSchema,
  listProductsQuerySchema
} from "../services/Products/products.zod";

openApiRegistry.registerPath({
  method: "put",
  path: "/admin/business/manage",
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
  method: "put",
  path: "/admin/me/password",
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

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/categories",
  tags: ["Categories"],
  summary: "Listar categorías con paginado y filtros",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    query: listCategoriesQuerySchema
  },
  responses: {
    "200": { description: "Lista de categorías" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/categories",
  tags: ["Categories"],
  summary: "Crear categoría de productos",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            name: createCategorySchema.shape.name,
            description: createCategorySchema.shape.description,
            image: z.any().optional().openapi({ type: "string", format: "binary" })
          })
        }
      }
    }
  },
  responses: {
    "201": { description: "Categoría creada" },
    "400": { description: "Datos invalidos" },
    "409": { description: "Categoría ya existe" }
  }
});

openApiRegistry.registerPath({
  method: "put",
  path: "/admin/categories/{id}",
  tags: ["Categories"],
  summary: "Actualizar categoría",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    params: z.object({ id: z.string().cuid() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            name: updateCategorySchema.shape.name,
            description: updateCategorySchema.shape.description,
            image: z.any().optional().openapi({ type: "string", format: "binary" })
          })
        }
      }
    }
  },
  responses: {
    "200": { description: "Categoría actualizada" },
    "400": { description: "Datos invalidos" },
    "404": { description: "Categoría no encontrada" }
  }
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/admin/categories/{id}",
  tags: ["Categories"],
  summary: "Eliminar categoría",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Categoría eliminada" },
    "404": { description: "Categoría no encontrada" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/products",
  tags: ["Products"],
  summary: "Listar productos con paginado y filtros",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    query: listProductsQuerySchema
  },
  responses: {
    "200": { description: "Lista de productos" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/products",
  tags: ["Products"],
  summary: "Crear producto",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            name: createProductSchema.shape.name,
            description: createProductSchema.shape.description,
            price: createProductSchema.shape.price,
            stock: createProductSchema.shape.stock,
            categoryId: createProductSchema.shape.categoryId,
            metadata: createProductSchema.shape.metadata,
            image: z.any().optional().openapi({ type: "string", format: "binary" })
          })
        }
      }
    }
  },
  responses: {
    "201": { description: "Producto creado" },
    "400": { description: "Datos invalidos" },
    "409": { description: "Producto ya existe" }
  }
});

openApiRegistry.registerPath({
  method: "put",
  path: "/admin/products/{id}",
  tags: ["Products"],
  summary: "Actualizar producto",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    params: z.object({ id: z.string().cuid() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            name: updateProductSchema.shape.name,
            description: updateProductSchema.shape.description,
            price: updateProductSchema.shape.price,
            stock: updateProductSchema.shape.stock,
            categoryId: updateProductSchema.shape.categoryId,
            metadata: updateProductSchema.shape.metadata,
            image: z.any().optional().openapi({ type: "string", format: "binary" })
          })
        }
      }
    }
  },
  responses: {
    "200": { description: "Producto actualizado" },
    "400": { description: "Datos invalidos" },
    "404": { description: "Producto no encontrado" }
  }
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/admin/products/bulk",
  tags: ["Products"],
  summary: "Eliminar productos en lote",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "application/json": {
          schema: deleteBulkSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Productos eliminados" }
  }
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/admin/products/bulk/status",
  tags: ["Products"],
  summary: "Actualizar estado de productos en lote",
  request: {
    headers: z.object({ "x-tenant-id": z.string() }),
    body: {
      content: {
        "application/json": {
          schema: patchBulkStatusSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Estados actualizados" }
  }
});

const router = Router();

router.put("/me/password", requireRole([1]), requireTenant, businessController.changePasswordBusiness);
router.get("/business", requireTenant, requireRole([1]), businessController.getBusiness);
router.get("/mercadopago/status", requireTenant, requireRole([1]), paymentsController.getMercadoPagoStatus);
router.get("/mercadopago/connect-url", requireTenant, requireRole([1]), paymentsController.getMercadoPagoConnectUrl);
router.put("/business/manage", requireTenant, requireRole([1]), uploadBusinessAssetsMiddleware, businessController.manageBusiness);

// Categorías
router.get(
  "/categories",
  requireTenant,
  requireRole([1]),
  categoriesController.getMany
);
router.post(
  "/categories",
  requireTenant,
  requireRole([1]),
  uploadAndConvertImageOptionalMiddleware,
  categoriesController.create
);
router.put(
  "/categories/:id",
  requireTenant,
  requireRole([1]),
  uploadAndConvertImageOptionalMiddleware,
  categoriesController.update
);
router.delete(
  "/categories/:id",
  requireTenant,
  requireRole([1]),
  categoriesController.delete
);

// Productos
router.get(
  "/products",
  requireTenant,
  requireRole([1]),
  productsController.getMany
);
router.post(
  "/products",
  requireTenant,
  requireRole([1]),
  uploadAndConvertImageOptionalMiddleware,
  productsController.create
);
router.put(
  "/products/:id",
  requireTenant,
  requireRole([1]),
  uploadAndConvertImageOptionalMiddleware,
  productsController.update
);
router.delete(
  "/products/bulk",
  requireTenant,
  requireRole([1]),
  productsController.deleteBulk
);
router.patch(
  "/products/bulk/status",
  requireTenant,
  requireRole([1]),
  productsController.patchBulkStatus
);

export { router as adminRouter };
