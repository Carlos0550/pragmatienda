import { Router } from "express";
import { z } from "zod";
import { openApiRegistry } from "../docs/swagger";

const healthResponseSchema = z
  .object({
    status: z.string().openapi({ example: "ok" })
  })
  .openapi("HealthResponse");

openApiRegistry.register("HealthResponse", healthResponseSchema);

openApiRegistry.registerPath({
  method: "get",
  path: "/health",
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

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export { router as healthRouter };
