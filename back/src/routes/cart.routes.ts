import { Router } from "express";
import { z } from "zod";
import { cartController } from "../controllers/cart.controller";
import { openApiRegistry } from "../docs/swagger";
import {
  attachAuthenticatedUserOptional,
  requireComprobante,
  requireIdempotencyKey,
  requireTenant,
  uploadComprobanteOptionalMiddleware
} from "../middlewares";
import { cartCheckoutSchema, deleteCartItemsSchema, guestCheckoutDetailsSchema, patchCartItemsSchema } from "../services/Cart/cart.zod";

const cartHeaders = z.object({
  "x-tenant-id": z.string(),
  Authorization: z.string().optional()
});
const checkoutHeaders = cartHeaders.extend({
  "idempotency-key": z.string().min(8)
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
    headers: checkoutHeaders,
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
            comprobante: z.any().optional().openapi({ type: "string", format: "binary" }),
            origin: cartCheckoutSchema.shape.origin,
            paymentProvider: cartCheckoutSchema.shape.paymentProvider.optional(),
            name: guestCheckoutDetailsSchema.shape.name.optional(),
            email: guestCheckoutDetailsSchema.shape.email.optional(),
            phone: guestCheckoutDetailsSchema.shape.phone.optional(),
            createAccountAfterPurchase: guestCheckoutDetailsSchema.shape.createAccountAfterPurchase.optional(),
            shippingMethodId: cartCheckoutSchema.shape.shippingMethodId,
            shippingQuoteId: cartCheckoutSchema.shape.shippingQuoteId.optional(),
            shippingSelectionType: cartCheckoutSchema.shape.shippingSelectionType,
            shippingAddress: z.string().optional().openapi({
              description: "JSON serializado con la dirección de envío"
            })
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

router.use(attachAuthenticatedUserOptional);
router.use(requireTenant);

router.get("/", cartController.getCart.bind(cartController));
router.delete("/items", cartController.deleteItems.bind(cartController));
router.patch("/items", cartController.patchItems.bind(cartController));
router.post(
  "/checkout",
  uploadComprobanteOptionalMiddleware,
  requireComprobante,
  requireIdempotencyKey("cart.checkout"),
  cartController.checkout.bind(cartController)
);

export { router as cartRouter };
