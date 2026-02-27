import { BillingStatus, PlanType, UserStatus } from "@prisma/client";
import { logger } from "../../config/logger";
import {
  createSessionToken,
  hashString,
  verifyHash,
} from "../../config/security";
import { prisma } from "../../db/prisma";
import { generateSecureString } from "../../utils/security.utils";
import {
  createBusinessTenantSchema,
  loginBusinessSchema,
} from "./business.zod";
import { z } from "zod";
import { buildWelcomeUserEmailHtml } from "../../utils/template.utils";
import { sendMail } from "../../mail/mailer";
import {
  capitalizeWords,
  normalizeText,
  toE164Argentina,
} from "../../utils/normalization.utils";
import { dayjs } from "../../config/dayjs";
import { env } from "../../config/env";
import {
  getPublicObjectFromDefaultBucket,
  uploadPublicObject,
} from "../../storage/minio";
import path from "path";
import { updateBusinessSchema } from "./business.zod";

type BankOption = {
  bankName: string;
  recipientName: string;
  aliasCvuCbu: string;
};

class BusinessService {
  async createBusinessTenant(
    data: z.infer<typeof createBusinessTenantSchema>,
  ): Promise<ServiceResponse> {
    try {
      const secureString = generateSecureString();
      const securePassword = await hashString(secureString);
      const businessNameForWebsite = normalizeText(data.name);
      const website = businessNameForWebsite
        ? `https://${businessNameForWebsite}.pragmatienda.com`
        : undefined;

      const transactionResult = await prisma.$transaction(async (tx) => {
        const existingBusiness = await tx.businessData.findFirst({
          where: { name: businessNameForWebsite },
          select: { id: true },
        });
        if (existingBusiness) {
          return {
            conflict: true as const,
          };
        }

        const adminUser = await tx.user.create({
          data: {
            name: capitalizeWords(data.adminName),
            email: data.adminEmail.toLowerCase().trim(),
            phone: toE164Argentina(normalizeText(data.phone)) ?? "",
            password: securePassword,
            role: 1,
            isVerified: false,
            status: UserStatus.PENDING,
          },
          select: { id: true, email: true, name: true },
        });

        const trialEndsAt = dayjs().add(7, "day").toDate();
        const tenant = await tx.tenant.create({
          data: {
            ownerId: adminUser.id,
            plan: PlanType.PRO,
            billingStatus: BillingStatus.TRIALING,
            trialEndsAt,
            planEndsAt: trialEndsAt
          },
          select: { id: true, plan: true },
        });

        await tx.user.update({
          where: { id: adminUser.id },
          data: { tenantId: tenant.id },
        });

        const business = await tx.businessData.create({
          data: {
            tenantId: tenant.id,
            name: businessNameForWebsite,
            website: website,
            address: data.address ? normalizeText(data.address) : undefined,
            phone: data.phone,
          },
        });

        return {
          conflict: false as const,
          adminUser,
          tenant,
          business,
        };
      });
      if (transactionResult.conflict) {
        return { status: 409, message: "El nombre del negocio ya existe." };
      }

      const { adminUser, tenant, business } = transactionResult;

      const html = await buildWelcomeUserEmailHtml({
        user: {
          ...adminUser,
          tenantId: tenant.id
        },
        plainPassword: secureString,
        business: {
          name: capitalizeWords(data.name),
          address: capitalizeWords(data.address),
          website: website,
          phone: data.phone,
          email: data.adminEmail,
        },
      });

      await sendMail({
        to: adminUser.email,
        subject: "Bienvenido a Pragmatienda",
        html,
      });

      return {
        status: 201,
        message: "Negocio y tenant creados correctamente.",
        data: {
          tenantId: tenant.id,
          plan: tenant.plan,
          businessId: business.id,
          adminEmail: adminUser.email,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en createBusinessTenant service", {
        message: err?.message,
        stack: err?.stack,
      });

      return {
        status: 500,
        message: "Error al crear negocio y tenant.",
        err: err.message,
      };
    }
  }

  async resolveTenantIdByStoreUrl(rawUrl: string): Promise<ServiceResponse> {
    try {
      const normalizedInput = rawUrl.trim();
      const withProtocol = /^https?:\/\//i.test(normalizedInput)
        ? normalizedInput
        : `https://${normalizedInput}`;

      let hostname = "";
      try {
        hostname = new URL(withProtocol).hostname.toLowerCase();
      } catch {
        return { status: 400, message: "URL invalida." };
      }

      const parts = hostname.split(".").filter(Boolean);
      const isPragmatiendaDomain =
        parts.length >= 3 &&
        parts[parts.length - 2] === "pragmatienda" &&
        parts[parts.length - 1] === "com";
      const isLocalhostDomain =
        env.NODE_ENV === "development" &&
        parts.length >= 2 &&
        parts[parts.length - 1] === "localhost";

      if (!isPragmatiendaDomain && !isLocalhostDomain) {
        return {
          status: 400,
          message: "La URL debe pertenecer a pragmatienda.com.",
        };
      }

      const storeNamePart = parts[0] === "www" ? parts[1] : parts[0];
      if (!storeNamePart) {
        return {
          status: 400,
          message: "No se pudo resolver el nombre de la tienda desde la URL.",
        };
      }

      const normalizedStoreName = normalizeText(storeNamePart);
      const business = await prisma.businessData.findFirst({
        where: { name: normalizedStoreName },
        select: {
          id: true,
          name: true,
          tenant: {
            select: { id: true },
          },
        },
      });

      if (!business?.tenant) {
        return {
          status: 404,
          message: "No se encontro tenant para la tienda indicada.",
        };
      }

      return {
        status: 200,
        message: "Tenant encontrado.",
        data: {
          tenantId: business.tenant.id,
          businessName: business.name,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en resolveTenantIdByStoreUrl service", {
        message: err?.message,
        stack: err?.stack,
      });
      return {
        status: 500,
        message: "No se pudo resolver el tenant.",
        err: err.message,
      };
    }
  }

  async getBusinessForTenant(tenantId: string): Promise<ServiceResponse> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          businessData: {
            select: {
              name: true,
              logo: true,
              banner: true,
              favicon: true,
              socialMedia: true,
              bankOptions: true,
            },
          },
        },
      });
      if (!tenant) {
        return { status: 404, message: "Tenant no encontrado." };
      }
      if (!tenant.businessData) {
        return { status: 404, message: "Negocio no encontrado para el tenant." };
      }
      const b = tenant.businessData;
      const socialMedia = b.socialMedia as Record<string, string> | Array<{ name: string; url: string }> | null;
      const rawBankOptions = b.bankOptions as BankOption[] | null;
      const slug = b.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      let socialLinks: { facebook?: string; instagram?: string; whatsapp?: string } | undefined;
      if (Array.isArray(socialMedia)) {
        const mapped = socialMedia.reduce<Record<string, string>>((acc, item) => {
          if (item && typeof item.name === "string" && typeof item.url === "string") {
            acc[item.name] = item.url;
          }
          return acc;
        }, {});
        socialLinks = {
          facebook: mapped.facebook ?? undefined,
          instagram: mapped.instagram ?? undefined,
          whatsapp: mapped.whatsapp ?? undefined,
        };
      } else if (socialMedia && typeof socialMedia === "object") {
        socialLinks = {
          facebook: (socialMedia as Record<string, string>).facebook ?? undefined,
          instagram: (socialMedia as Record<string, string>).instagram ?? undefined,
          whatsapp: (socialMedia as Record<string, string>).whatsapp ?? undefined,
        };
      }
      const bankOptions = Array.isArray(rawBankOptions)
        ? rawBankOptions
            .filter((item) =>
              Boolean(
                item &&
                typeof item.bankName === "string" &&
                typeof item.recipientName === "string" &&
                typeof item.aliasCvuCbu === "string"
              )
            )
            .map((item) => ({
              bankName: item.bankName,
              recipientName: item.recipientName,
              aliasCvuCbu: item.aliasCvuCbu,
            }))
        : [];

      return {
        status: 200,
        message: "OK",
        data: {
          id: tenant.id,
          name: b.name,
          slug,
          logo: b.logo ?? undefined,
          banner: b.banner ?? undefined,
          favicon: b.favicon ?? undefined,
          socialLinks,
          bankOptions,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en getBusinessForTenant", { message: err?.message });
      return { status: 500, message: "Error interno del servidor." };
    }
  }

  async manageBusiness(
    tenantId: string,
    data: z.infer<typeof updateBusinessSchema>,
  ): Promise<ServiceResponse> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          businessData: {
            select: { id: true, name: true },
          },
        },
      });
      if (!tenant) {
        return { status: 404, message: "Tenant no encontrado." };
      }
      if (!tenant.businessData) {
        return { status: 404, message: "Negocio no encontrado para el tenant." };
      }

      const uploadAsset = async (
        folder: "logos" | "banners" | "favicons",
        file: z.infer<typeof updateBusinessSchema>["logo"],
      ) => {
        if (!file) {
          return undefined;
        }
        const ext =
          path.extname(file.originalname ?? "").toLowerCase() || ".bin";
        const objectName = `${folder}/${tenantId}/${Date.now()}_${generateSecureString()}${ext}`;
        await uploadPublicObject({
          objectName,
          buffer: file.buffer as Buffer,
          contentType: file.mimetype,
        });
        return getPublicObjectFromDefaultBucket(objectName);
      };

      const logoUrl = await uploadAsset("logos", data.logo);
      const bannerUrl = await uploadAsset("banners", data.banner);
      const faviconUrl = await uploadAsset("favicons", data.favicon);

      const socialMediaPayload = Array.isArray(data.socialMedia)
        ? data.socialMedia.reduce<Record<string, string>>((acc, item) => {
            if (item && typeof item.name === "string" && typeof item.url === "string") {
              acc[item.name] = item.url;
            }
            return acc;
          }, {})
        : undefined;
      const bankOptionsPayload = Array.isArray(data.bankOptions)
        ? data.bankOptions.map((option) => ({
            bankName: option.bankName.trim(),
            recipientName: option.recipientName.trim(),
            aliasCvuCbu: option.aliasCvuCbu.trim(),
          }))
        : undefined;

      const updatePayload = {
        ...(data.description ? { description: data.description.trim() } : {}),
        ...(data.address ? { address: data.address.trim() } : {}),
        ...(data.phone ? { phone: data.phone.trim() } : {}),
        ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
        ...(socialMediaPayload ? { socialMedia: socialMediaPayload } : {}),
        ...(bankOptionsPayload !== undefined ? { bankOptions: bankOptionsPayload } : {}),
        ...(logoUrl ? { logo: logoUrl } : {}),
        ...(bannerUrl ? { banner: bannerUrl } : {}),
        ...(faviconUrl ? { favicon: faviconUrl } : {}),
      };

      if (Object.keys(updatePayload).length === 0) {
        return { status: 400, message: "No hay datos para actualizar." };
      }

      const business = await prisma.businessData.update({
        where: { tenantId },
        data: updatePayload,
      });

      return {
        status: 200,
        message: "Negocio actualizado correctamente.",
        data: business,
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en manageBusiness service", {
        message: err?.message,
        stack: err?.stack,
      });
      return {
        status: 500,
        message: "No se pudo actualizar el negocio.",
        err: err.message,
      };
    }
  }

  async loginBusinessTenant(
    data: z.infer<typeof loginBusinessSchema>,
    tenantId: string,
  ): Promise<ServiceResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email_tenantId_role: {
            email: data.email,
            tenantId: tenantId,
            role: 1,
          },
        },
      });

      if (!user) {
        return { status: 401, message: "Credenciales inválidas." };
      }
      const isPasswordValid = await verifyHash(data.password, user.password);
      if (!isPasswordValid) {
        return { status: 401, message: "Contraseña incorrecta." };
      }
      const token = await createSessionToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });
      return { status: 200, message: "Login exitoso.", data: { token } };
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en loginBusinessTenant service", {
        message: err?.message,
        stack: err?.stack,
      });
      return {
        status: 500,
        message: "No se pudo iniciar sesión en el negocio.",
        err: err.message,
      };
    }
  }
}

export const businessService = new BusinessService();
