import { Request, Response } from "express";
import { logger } from "../config/logger";
import { businessService } from "../services/Business/business.service";
import { createBusinessTenantSchema, loginBusinessSchema, resolveTenantByStoreUrlSchema, updateBusinessSchema } from "../services/Business/business.zod";
import { normalizeText, removeSpaces, toE164Argentina } from "../utils/normalization.utils";
import { changePasswordSchema, recoverPasswordSchema } from "../services/Users/user.zod";
import { userService } from "../services/Users/user.service";

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
        name: removeSpaces(normalizeText(parsed.data.name)),
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

  async getBusiness(req: Request, res: Response): Promise<Response> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const result = await businessService.getBusinessForTenant(tenantId);
      if (result.status !== 200 || !result.data) {
        return res.status(result.status).json({ message: result.message });
      }
      return res.status(200).json(result.data);
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getBusiness controller", { message: err?.message });
      return res.status(500).json({ message: "Error interno del servidor." });
    }
  }

  async manageBusiness(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const uploadedFiles = (req.files as Record<string, Express.Multer.File[]>) ?? {};
      const logo = uploadedFiles.logo?.[0];
      const banner = uploadedFiles.banner?.[0];
      const favicon = uploadedFiles.favicon?.[0]; 

      let socialMedia: unknown = req.body.socialMedia;
      if (typeof socialMedia === "string" && socialMedia.trim().length > 0) {
        try {
          socialMedia = JSON.parse(socialMedia);
        } catch {
          return res.status(400).json({
            message: "Datos invalidos.",
            err: { socialMedia: ["socialMedia debe ser JSON valido."] }
          });
        }
      }

      let bankOptions: unknown = req.body.bankOptions;
      if (typeof bankOptions === "string") {
        if (bankOptions.trim().length === 0) {
          bankOptions = [];
        } else {
          try {
            bankOptions = JSON.parse(bankOptions);
          } catch {
            return res.status(400).json({
              message: "Datos invalidos.",
              err: { bankOptions: ["bankOptions debe ser JSON valido."] }
            });
          }
        }
      }

      const parsed = updateBusinessSchema.safeParse({
        ...req.body,
        socialMedia,
        bankOptions,
        logo,
        banner,
        favicon
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const result = await businessService.manageBusiness(req.tenantId, parsed.data);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en manageBusiness controller: ", err.message);
      return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
    }
  }

  async loginBusiness(req: Request, res: Response): Promise<Response> {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }
      const parsed = loginBusinessSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.error("Error catched en loginBusiness controller: ", parsed.error.flatten().fieldErrors);
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }
      
      const result = await businessService.loginBusinessTenant(parsed.data, req.tenantId!);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en loginBusiness controller: ", err.message);
      return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
    }
  }

  async recoverPasswordBusiness(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = recoverPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant requerido." });
      }

      const result = await userService.recoverPassword(tenantId, parsed.data, 1);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en recoverPasswordBusiness controller: ", err.message);
      return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
    }
  }

  async changePasswordBusiness(req: Request, res: Response): Promise<Response> {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos invalidos.",
          err: parsed.error.flatten().fieldErrors
        });
      }

      const userId = req.user?.id;
      const tenantId = req.tenantId;
      if (!userId || !tenantId) {
        return res.status(401).json({ message: "No autorizado." });
      }

      const result = await userService.changePassword(userId, tenantId, parsed.data, 1);
      return res.status(result.status).json(result);
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en changePasswordBusiness controller: ", err.message);
      return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
    }
  }
}

export const businessController = new BusinessController();
