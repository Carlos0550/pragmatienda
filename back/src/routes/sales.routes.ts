import { Router } from "express";
import { z } from "zod";
import { salesController } from "../controllers/sales.controller";
import { openApiRegistry } from "../docs/swagger";
import { requireRole, requireTenant } from "../middlewares";
import { listSalesQuerySchema, updateSaleSchema, patchSaleItemsSchema } from "../services/Sales/sales.zod";

const salesHeaders = z.object({
  "x-tenant-id": z.string(),
  Authorization: z.string()
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/sales",
  tags: ["Sales"],
  summary: "Listar ventas con paginación y filtros",
  request: {
    headers: salesHeaders,
    query: listSalesQuerySchema
  },
  responses: {
    "200": { description: "Lista de ventas" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/sales/metrics",
  tags: ["Sales"],
  summary: "Obtener métricas de ventas para gráficos",
  request: {
    headers: salesHeaders,
    query: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
      groupBy: z.enum(["day", "week", "month"]).optional()
    })
  },
  responses: {
    "200": { description: "Métricas de ventas" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/sales/{id}",
  tags: ["Sales"],
  summary: "Obtener detalle de una venta",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Detalle de venta" },
    "404": { description: "Venta no encontrada" }
  }
});

openApiRegistry.registerPath({
  method: "put",
  path: "/admin/sales/{id}",
  tags: ["Sales"],
  summary: "Actualizar venta (discount, status)",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() }),
    body: {
      content: {
        "application/json": {
          schema: updateSaleSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Venta actualizada" },
    "404": { description: "Venta no encontrada" }
  }
});

openApiRegistry.registerPath({
  method: "patch",
  path: "/admin/sales/{id}/items",
  tags: ["Sales"],
  summary: "Modificar items de una venta (eliminar o reemplazar)",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() }),
    body: {
      content: {
        "application/json": {
          schema: patchSaleItemsSchema
        }
      }
    }
  },
  responses: {
    "200": { description: "Items actualizados" },
    "404": { description: "Venta no encontrada" },
    "409": { description: "Stock insuficiente" }
  }
});

openApiRegistry.registerPath({
  method: "delete",
  path: "/admin/sales/{id}",
  tags: ["Sales"],
  summary: "Eliminar venta (hard delete con restauración de stock)",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Venta eliminada" },
    "404": { description: "Venta no encontrada" }
  }
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/sales/{id}/payment-proof",
  tags: ["Sales"],
  summary: "Obtener URL firmada del comprobante de pago",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "URL firmada del comprobante" },
    "404": { description: "Venta no encontrada o sin comprobante" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/sales/{id}/shipment/create",
  tags: ["Sales"],
  summary: "Generar envío para la venta",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Envío generado o actualizado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/sales/{id}/shipment/refresh",
  tags: ["Sales"],
  summary: "Actualizar estado del envío asociado",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Estado de envío actualizado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/sales/{id}/shipment/requote",
  tags: ["Sales"],
  summary: "Recotizar envío asociado",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Envío recotizado" }
  }
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/sales/{id}/shipment/mark-picked-up",
  tags: ["Sales"],
  summary: "Marcar retiro en local como completado",
  request: {
    headers: salesHeaders,
    params: z.object({ id: z.string().cuid() })
  },
  responses: {
    "200": { description: "Pedido marcado como retirado" }
  }
});

const router = Router();

router.use(requireRole([1]));
router.use(requireTenant);

router.get("/", salesController.list);
router.get("/metrics", salesController.getMetrics);
router.get("/:id", salesController.getOne);
router.put("/:id", salesController.update);
router.patch("/:id/items", salesController.patchItems);
router.get("/:id/payment-proof", salesController.getPaymentProof);
router.post("/:id/shipment/create", salesController.createShipment);
router.post("/:id/shipment/refresh", salesController.refreshShipment);
router.post("/:id/shipment/requote", salesController.requoteShipment);
router.post("/:id/shipment/mark-picked-up", salesController.markPickedUp);
router.delete("/:id", salesController.delete);

export { router as salesRouter };
