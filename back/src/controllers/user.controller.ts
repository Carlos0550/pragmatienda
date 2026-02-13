import { Request, Response } from "express";
import { changePasswordSchema, loginSchema, publicRegisterUserSchema, recoverPasswordSchema, updateUserSchema } from "../services/Users/user.zod";
import z from "zod";
import path from "path";
import { capitalizeWords, normalizeText, toE164Argentina } from "../utils/normalization.utils";
import { userService } from "../services/Users/user.service";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { renderTemplate } from "../utils/template.utils";
import { prisma } from "../db/prisma";
import { decryptString } from "../config/security";
import { generateSecureString } from "../utils/security.utils";
import { getPublicObjectFromDefaultBucket, uploadPublicObject } from "../storage/minio";

class UserController{
    async publicRegisterUser(req: Request, res: Response): Promise<Response>{
        try {
            const parsed = publicRegisterUserSchema.safeParse(req.body);
            if (!parsed.success) {
                logger.error("Error catched en publicRegisterUser controller: ", parsed.error.flatten().fieldErrors)
                return res.status(400).json({
                message: "Datos invalidos.",
                err: parsed.error.flatten().fieldErrors
            })
            }

            const {
                name,
                email,
                phone
            } = parsed.data

            const payload = {
                name: capitalizeWords(name),
                email: email.toLowerCase(),
                phone: phone ? toE164Argentina(normalizeText(phone)) ?? undefined : undefined
            }

            const user = await userService.publicRegisterUser(payload, req.tenantId!);

            return res.status(user.status).json({
                message: user.message,
                err: user.err
            })
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en publicRegisterUser controller: ", err.message)
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }

    async verifyAccount(req: Request, res: Response): Promise<Response> {
        try {
            const token = typeof req.query.token === "string" ? req.query.token : "";
            if (!token) {
                return res.status(400).type("html").send("Token de verificacion requerido.");
            }

            const businessWebsite = await prisma.businessData.findFirst({
                where:{
                    tenantId: req.tenantId
                }
            })

            const result = await userService.verifyAccount(token, req.tenantId ?? null);
            if (result.status === 200) {
                res.redirect(businessWebsite?.website ?? "");
                return res;
            }

            let payload: { id?: string; email?: string } = {};
            try {
                const payloadRaw = decryptString(token);
                payload = JSON.parse(payloadRaw) as { id?: string; email?: string };
            } catch {
                return res.status(400).type("html").send(result.message);
            }

            if (!payload.id || !payload.email) {
                return res.status(400).type("html").send(result.message);
            }

            const user = await prisma.user.findFirst({
                where: {
                    id: payload.id,
                    ...(req.tenantId ? { tenantId: req.tenantId } : {})
                },
                select: {
                    email: true,
                    tenant: {
                        select: {
                            businessData: true
                        }
                    }
                }
            });
            if (!user || user.email !== payload.email || !user.tenant) {
                return res.status(result.status).type("html").send(result.message);
            }

            const business = user.tenant.businessData;
            if (!business) {
                return res.status(result.status).type("html").send(result.message);
            }
            const businessLogoBlock = business.logo
                ? `<div style="margin:12px 0;"><img src="${business.logo}" alt="${business.name}" style="max-width:100%; height:auto; border-radius:6px;" /></div>`
                : "";
            const businessBannerBlock = business.banner
                ? `<div style="margin:12px 0;"><img src="${business.banner}" alt="${business.name}" style="max-width:100%; height:auto; border-radius:6px;" /></div>`
                : "";
            const html = await renderTemplate("verify_failed_business.html", {
                message: result.message,
                businessName: business.name ?? "",
                businessDescription: business.description ?? "",
                businessAddress: business.address ?? "",
                businessPhone: business.phone ?? "",
                businessEmail: business.email ?? "",
                businessWebsite: business.website ?? "",
                businessLogoBlock,
                businessBannerBlock
            });
            return res.status(result.status).type("html").send(html);
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en verifyAccount controller: ", err.message)
            return res.status(500).type("html").send("Error interno del servidor.");
        }
    }

    async login(req: Request, res: Response): Promise<Response>{
        try {
            const parsed = loginSchema.safeParse(req.body)
            if(!parsed.success){
                logger.error("Error catched en login controller: ", parsed.error.flatten().fieldErrors)
                return res.status(400).json({
                    message: "Datos invalidos.",
                    err: parsed.error.flatten().fieldErrors
                })
            }

            const tenantId = req.tenantId;
            const result = await userService.login(parsed.data, tenantId)

            return res.status(result.status).json({
                result
            })
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en login controller: ", err.message)
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }

    async getMe(req: Request, res: Response): Promise<Response>{
        try {
            const userId = req.user?.id
            const tenantId = req.tenantId;
            if (!userId || !tenantId) {
                return res.status(401).json({ message: "No autorizado." });
            }
            const result = await userService.getMe(userId, tenantId)

            return res.status(result.status).json({
                result
            })
            
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en getMe controller: ", err.message)
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }

    async updateMe(req: Request, res: Response): Promise<Response>{
        try {
            const parsed = updateUserSchema.safeParse(req.body)
            if(!parsed.success){
                logger.error("Error catched en updateMe controller: ", parsed.error.flatten().fieldErrors)
                return res.status(400).json({
                    message: "Datos invalidos.",
                    err: parsed.error.flatten().fieldErrors
                })
            }

            const userId = req.user?.id
            const tenantId = req.tenantId;
            if (!userId || !tenantId) {
                return res.status(401).json({ message: "No autorizado." });
            }
            const data = parsed.data
            const phoneNormalized = data.phone
                ? toE164Argentina(normalizeText(data.phone)) ?? undefined
                : undefined
            const payload = {
                ...(data.name ? { name: normalizeText(data.name) } : {}),
                ...(data.email ? { email: data.email.toLowerCase() } : {}),
                ...(phoneNormalized ? { phone: phoneNormalized } : {})
            }

            const result = await userService.updateMe(userId, tenantId, payload)

            return res.status(result.status).json({
                result
            })
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en updateMe controller: ", err.message)
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }

    async updateAvatar(req: Request, res: Response): Promise<Response>{
        try {
            const userId = req.user?.id
            const tenantId = req.tenantId;
            if (!userId || !tenantId) {
                return res.status(401).json({ message: "No autorizado." });
            }
            const file = req.file
            if (!file) {
                return res.status(400).json({ message: "Archivo de avatar requerido." });
            }

            const extension = path.extname(file.originalname ?? "").toLowerCase();
            const objectName = `avatares/${userId}/${Date.now()}_${generateSecureString()}${extension}`;

            await uploadPublicObject({
                objectName,
                buffer: file.buffer,
                contentType: file.mimetype
            });
            const avatarUrl = getPublicObjectFromDefaultBucket(objectName);
            const result = await userService.updateAvatar(userId, tenantId, avatarUrl)

            return res.status(result.status).json({
                result
            })
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en updateAvatar controller: ", err.message)
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }

    async changePassword(req: Request, res: Response): Promise<Response> {
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
            const result = await userService.changePassword(userId, tenantId, parsed.data);
            return res.status(result.status).json(result);
        } catch (error) {
            const err = error as Error;
            logger.error("Error catched en changePassword controller: ", err.message);
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }

    async recoverPassword(req: Request, res: Response): Promise<Response> {
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

            const result = await userService.recoverPassword(tenantId, parsed.data);
            return res.status(result.status).json(result);
        } catch (error) {
            const err = error as Error;
            logger.error("Error catched en recoverPassword controller: ", err.message);
            return res.status(500).json({ message: "Error interno del servidor, por favor intente nuevamente." });
        }
    }
}

export const userController = new UserController();