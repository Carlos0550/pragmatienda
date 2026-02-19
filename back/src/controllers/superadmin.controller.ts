import type { Request, Response } from "express";
import { logger } from "../config/logger";
import { plansService, PlansServiceError } from "../superadmin/application/plans.service";
import { createPlanSchema, updatePlanSchema } from "../superadmin/plans.zod";

class SuperadminController {
  async listPlans(_req: Request, res: Response): Promise<Response> {
    try {
      const plans = await plansService.listPlans();
      return res.status(200).json({ data: plans });
    } catch (error) {
      if (error instanceof PlansServiceError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en listPlans", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async getPlanById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const plan = await plansService.getPlanById(id);
      return res.status(200).json({ data: plan });
    } catch (error) {
      if (error instanceof PlansServiceError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en getPlanById", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async createPlan(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = createPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos",
          err: parsed.error.flatten().fieldErrors
        });
      }
      const plan = await plansService.createPlan(parsed.data);
      return res.status(201).json({
        message: "Plan creado correctamente.",
        data: plan
      });
    } catch (error) {
      if (error instanceof PlansServiceError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en createPlan", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async updatePlan(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const parsed = updatePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos",
          err: parsed.error.flatten().fieldErrors
        });
      }
      const plan = await plansService.updatePlan(id, parsed.data);
      return res.status(200).json({
        message: "Plan actualizado correctamente.",
        data: plan
      });
    } catch (error) {
      if (error instanceof PlansServiceError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en updatePlan", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async deletePlan(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const result = await plansService.deletePlan(id);
      return res.status(200).json({
        message: "Plan desactivado correctamente.",
        data: result
      });
    } catch (error) {
      if (error instanceof PlansServiceError) {
        return res.status(error.status).json({
          message: error.message,
          code: error.code
        });
      }
      const err = error as Error;
      logger.error("Error en deletePlan", { message: err.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }
}

export const superadminController = new SuperadminController();
