import { Request, Response } from "express";
import { logger } from "../config/logger";
import { productsService } from "../services/Products/products.service";
import {
  createProductSchema,
  updateProductSchema,
  patchBulkStatusSchema,
  deleteBulkSchema,
  listProductsQuerySchema
} from "../services/Products/products.zod";

function parseMetadata(value: unknown): unknown {
  if (value == null || value === "") return undefined;
  if (typeof value === "object") return value;
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

class ProductsController {
  async getMany(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = listProductsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await productsService.getMany(tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getMany products controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      
      const categoryIdRaw = req.body.categoryId;
      const categoryId =
        categoryIdRaw === "" || categoryIdRaw === "null" ? undefined : categoryIdRaw;
      const bodyForSchema = {
        ...req.body,
        
        categoryId
      };

      const parsed = createProductSchema.safeParse(bodyForSchema);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await productsService.create(
        tenantId,
        parsed.data,
        req.file
      );
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en createProduct controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const id = req.params.id;
      if (!tenantId || !id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }

      const metadata = parseMetadata(req.body.metadata);
      const categoryIdRaw = req.body.categoryId;
      const categoryId =
        categoryIdRaw === "" || categoryIdRaw === "null" ? null : categoryIdRaw;
      const bodyForSchema = {
        ...req.body,
        metadata: metadata ?? undefined,
        categoryId
      };

      const parsed = updateProductSchema.safeParse(bodyForSchema);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await productsService.update(
        id,
        tenantId,
        parsed.data,
        req.file
      );
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en updateProduct controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async deleteBulk(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = deleteBulkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await productsService.deleteBulk(parsed.data.ids, tenantId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en deleteBulk controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async patchBulkStatus(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = patchBulkStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await productsService.patchBulkStatus(parsed.data, tenantId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en patchBulkStatus controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const productsController = new ProductsController();
