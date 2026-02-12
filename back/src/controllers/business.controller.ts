import { Request, Response } from "express";
import { logger } from "../config/logger";
import { businessService } from "../services/Business/business.service";
import { createBusinessTenantSchema, resolveTenantByStoreUrlSchema } from "../services/Business/business.zod";
import { normalizeText, toE164Argentina } from "../utils/normalization.utils";

class BusinessController {
  async createBusinessTenant(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = createBusinessTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.error("Error catched en createBusinessTenant controller: ", parsed.error.flatten().fieldErrors);
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const payload = {
        name: normalizeText(parsed.data.name),
        description: normalizeText(parsed.data.description ?? ""),
        address: normalizeText(parsed.data.address),
        phone: toE164Argentina(normalizeText(parsed.data.phone)) ?? parsed.data.phone,
        adminEmail: parsed.data.adminEmail.toLowerCase(),
        adminName: parsed.data.adminName
      };

      const result = await businessService.createBusinessTenant(payload);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en createBusinessTenant controller: ", err.message);
      return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
    }
  }

  async resolveTenantByStoreUrl(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = resolveTenantByStoreUrlSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await businessService.resolveTenantIdByStoreUrl(parsed.data.url);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en resolveTenantByStoreUrl controller: ", err.message);
      return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
    }
  }
}

export const businessController = new BusinessController();
