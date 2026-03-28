import { Router } from "express";
import { z } from "zod";
import { shippingController } from "../controllers/shipping.controller";
import { openApiRegistry } from "../docs/swagger";
import { requireRole, requireTenant } from "../middlewares";
import {
  createShippingMethodSchema,
  shipmentStatusPatchSchema,
  updateShippingMethodSchema,
} from "../services/Shipping/shipping.zod";

const shippingHeaders = z.object({
  "x-tenant-id": z.string(),
  Authorization: z.string(),
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/shipping-methods",
  tags: ["Shipping"],
  summary: "Listar formas de envío del tenant",
  request: { headers: shippingHeaders },
  responses: {
    "200": { description: "Formas de envío obtenidas" },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/shipping-methods",
  tags: ["Shipping"],
  summary: "Crear forma de envío",
  request: {
    headers: shippingHeaders,
    body: { content: { "application/json": { schema: createShippingMethodSchema } } },
  },
  responses: {
    "201": { description: "Forma de envío creada" },
  },
});

openApiRegistry.registerPath({
  method: "put",
  path: "/admin/shipping-methods/{id}",
  tags: ["Shipping"],
  summary: "Actualizar forma de envío",
  request: {
    headers: shippingHeaders,
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: updateShippingMethodSchema } } },
  },
  responses: {
    "200": { description: "Forma de envío actualizada" },
  },
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/admin/shipping-methods/{id}/status",
  tags: ["Shipping"],
  summary: "Activar o desactivar una forma de envío",
  request: {
    headers: shippingHeaders,
    params: z.object({ id: z.string().cuid() }),
    body: { content: { "application/json": { schema: shipmentStatusPatchSchema } } },
  },
  responses: {
    "200": { description: "Estado actualizado" },
  },
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/admin/shipping-methods/{id}",
  tags: ["Shipping"],
  summary: "Eliminar forma de envío",
  request: {
    headers: shippingHeaders,
    params: z.object({ id: z.string().cuid() }),
  },
  responses: {
    "200": { description: "Forma de envío eliminada" },
  },
});

const router = Router();

router.use(requireRole([1]));
router.use(requireTenant);

router.get("/", shippingController.listMethods);
router.post("/", shippingController.createMethod);
router.put("/:id", shippingController.updateMethod);
router.patch("/:id/status", shippingController.patchMethodStatus);
router.delete("/:id", shippingController.deleteMethod);

export { router as shippingRouter };
