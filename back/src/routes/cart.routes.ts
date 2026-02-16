import { Router } from "express";
import { z } from "zod";
import { cartController } from "../controllers/cart.controller";
import { openApiRegistry } from "../docs/swagger";
import { requireRole, requireTenant, uploadComprobanteMiddleware } from "../middlewares";
import { patchCartItemsSchema, deleteCartItemsSchema } from "../services/Cart/cart.zod";

const cartHeaders = z.object({
  "x-tenant-id": z.string(),
  Authorization: z.string()
});

openApiRegistry.registerPath({
  method: "get",
  path: "/cart",
  tags: ["Cart"],
  summary: "Obtener carrito del usuario",
  request: {
    headers: cartHeaders
  },
  responses: {
    "200": { description: "Carrito obtenido" }
  }
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/cart/items",
  tags: ["Cart"],
  summary: "Eliminar items del carrito",
  request: {
    headers: cartHeaders,
    body: {
      content: {
        "application/json": {
          schema: deleteCartItemsSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Items eliminados" },
    "400": { description: "Datos inválidos" }
  }
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/cart/items",
  tags: ["Cart"],
  summary: "Incrementar o decrementar cantidad de producto en el carrito",
  request: {
    headers: cartHeaders,
    body: {
      content: {
        "application/json": {
          schema: patchCartItemsSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Cantidad actualizada" },
    "400": { description: "Datos inválidos o stock insuficiente" },
    "404": { description: "Producto no encontrado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/cart/checkout",
  tags: ["Cart"],
  summary: "Finalizar orden con comprobante de pago",
  request: {
    headers: cartHeaders,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            comprobante: z.any().openapi({ type: "string", format: "binary" })
          })
        }
      }
    }
  },
  responses: {
    "200": { description: "Comprobante subido correctamente" },
    "400": { description: "Carrito vacío o comprobante requerido" }
  }
});

const router = Router();

router.use(requireTenant);

router.get("/", requireRole([2]), cartController.getCart);
router.delete("/items", requireRole([2]), cartController.deleteItems);
router.patch("/items", requireRole([2]), cartController.patchItems);
router.post(
  "/checkout",
  requireRole([2]),
  uploadComprobanteMiddleware,
  cartController.checkout
);

export { router as cartRouter };
