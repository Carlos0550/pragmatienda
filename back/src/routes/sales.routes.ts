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

const router = Router();

router.use(requireRole([1]));
router.use(requireTenant);

router.get("/", salesController.list);
router.get("/metrics", salesController.getMetrics);
router.get("/:id", salesController.getOne);
router.put("/:id", salesController.update);
router.patch("/:id/items", salesController.patchItems);
router.delete("/:id", salesController.delete);

export { router as salesRouter };
