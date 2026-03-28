import { Router } from "express";
import { z } from "zod";
import { shipnowController } from "../controllers/shipnow.controller";
import { openApiRegistry } from "../docs/swagger";
import { requireRole, requireTenant } from "../middlewares";

const shipnowHeaders = z.object({
  "x-tenant-id": z.string(),
  Authorization: z.string(),
});

openApiRegistry.registerPath({
  method: "get",
  path: "/admin/shipnow/config",
  tags: ["ShipNow"],
  summary: "Obtener configuración de ShipNow del tenant",
  request: { headers: shipnowHeaders },
  responses: {
    "200": { description: "Configuración obtenida" },
  },
});

openApiRegistry.registerPath({
  method: "post",
  path: "/admin/shipnow/accept-terms",
  tags: ["ShipNow"],
  summary: "Aceptar términos de ShipNow",
  request: { headers: shipnowHeaders },
  responses: {
    "200": { description: "Términos aceptados" },
  },
});

const router = Router();

router.use(requireRole([1]));
router.use(requireTenant);

router.get("/config", shipnowController.getConfig);
router.post("/accept-terms", shipnowController.acceptTerms);

export { router as shipnowRouter };
