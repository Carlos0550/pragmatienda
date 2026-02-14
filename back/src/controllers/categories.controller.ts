import { Request, Response } from "express";
import { logger } from "../config/logger";
import { categoriesService } from "../services/Categories/categories.service";
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema
} from "../services/Categories/categories.zod";

class CategoriesController {
  async getMany(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = listCategoriesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await categoriesService.getMany(tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getMany categories controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const parsed = createCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await categoriesService.create(
        tenantId,
        parsed.data,
        req.file
      );
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en createCategory controller:", err.message);
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

      const parsed = updateCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await categoriesService.update(
        id,
        tenantId,
        parsed.data,
        req.file
      );
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en updateCategory controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      const id = req.params.id;
      if (!tenantId || !id) {
        return res.status(400).json({ message: "Tenant e id requeridos." });
      }

      const result = await categoriesService.delete(id, tenantId);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en deleteCategory controller:", err.message);
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const categoriesController = new CategoriesController();
