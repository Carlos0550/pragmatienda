import { PlanType, UserStatus } from "@prisma/client";
import { logger } from "../../config/logger";
import { hashString } from "../../config/security";
import { prisma } from "../../db/prisma";
import { generateSecureString } from "../../utils/security.utils";
import { createBusinessTenantSchema } from "./business.zod";
import { z } from "zod";
import { buildWelcomeUserEmailHtml } from "../../utils/template.utils";
import { sendMail } from "../../mail/mailer";
import { capitalizeWords, normalizeText, toE164Argentina } from "../../utils/normalization.utils";
import { dayjs } from "../../config/dayjs";
import { env } from "../../config/env";

class BusinessService {
  async createBusinessTenant(data: z.infer<typeof createBusinessTenantSchema>): Promise<ServiceResponse> {
    let createdUserId: string | null = null;
    let createdBusinessId: string | null = null;
    let createdTenantId: string | null = null;

    try {
      const secureString = generateSecureString();
      const securePassword = await hashString(secureString);

      const adminUser = await prisma.user.create({
        data: {
          name: capitalizeWords(data.adminName),
          email: data.adminEmail.toLowerCase().trim(),
          phone: toE164Argentina(normalizeText(data.phone)) ?? "",
          password: securePassword,
          role: 2,
          isVerified: false,
          status: UserStatus.PENDING
        },
        select: { id: true, email: true, name: true }
      });
      createdUserId = adminUser.id;

      const business = await prisma.businessData.create({
        data: {
          name: normalizeText(data.name),
          description: data.description ? normalizeText(data.description) : undefined,
          address: data.address ? normalizeText(data.address) : undefined,
          phone: data.phone
        }
      });
      createdBusinessId = business.id;

      const tenant = await prisma.tenant.create({
        data: {
          businessId: business.id,
          ownerId: adminUser.id,
          plan: PlanType.PRO,
          planEndsAt: dayjs().add(7, "day").toDate()
        },
        select: { id: true, plan: true, businessId: true }
      });
      createdTenantId = tenant.id;

      await prisma.user.update({
        where: { id: adminUser.id },
        data: { tenantId: tenant.id }
      });

      const html = await buildWelcomeUserEmailHtml({
        user: adminUser,
        plainPassword: secureString,
        business: {
          name: capitalizeWords(data.name),
          description: data.description,
          address: capitalizeWords(data.address),
          phone: data.phone,
          email: data.adminEmail,
        }
    });

    await sendMail({
        to: adminUser.email,
        subject: "Bienvenido a Pragmatienda",
        html
    });

      return {
        status: 201,
        message: "Negocio y tenant creados correctamente.",
        data: {
          tenantId: tenant.id,
          plan: tenant.plan,
          businessId: tenant.businessId,
          adminEmail: adminUser.email
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en createBusinessTenant service", {
        message: err?.message,
        stack: err?.stack
      });

      if (createdTenantId) {
        await prisma.tenant.delete({ where: { id: createdTenantId } }).catch(() => undefined);
      }
      if (createdBusinessId) {
        await prisma.businessData.delete({ where: { id: createdBusinessId } }).catch(() => undefined);
      }
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => undefined);
      }

      return {
        status: 500,
        message: "Error al crear negocio y tenant.",
        err: err.message
      };
    }
  }

  async resolveTenantIdByStoreUrl(rawUrl: string): Promise<ServiceResponse> {
    try {
      const normalizedInput = rawUrl.trim();
      const withProtocol = /^https?:\/\//i.test(normalizedInput) ? normalizedInput : `https://${normalizedInput}`;

      let hostname = "";
      try {
        hostname = new URL(withProtocol).hostname.toLowerCase();
      } catch {
        return { status: 400, message: "URL invalida." };
      }

      const parts = hostname.split(".").filter(Boolean);
      const isPragmatiendaDomain =
        parts.length >= 3 && parts[parts.length - 2] === "pragmatienda" && parts[parts.length - 1] === "com";
      const isLocalhostDomain = env.NODE_ENV === "development" && parts.length >= 2 && parts[parts.length - 1] === "localhost";

      if (!isPragmatiendaDomain && !isLocalhostDomain) {
        return { status: 400, message: "La URL debe pertenecer a pragmatienda.com." };
      }

      const storeNamePart = parts[0] === "www" ? parts[1] : parts[0];
      if (!storeNamePart) {
        return { status: 400, message: "No se pudo resolver el nombre de la tienda desde la URL." };
      }

      const normalizedStoreName = normalizeText(storeNamePart);
      const business = await prisma.businessData.findFirst({
        where: { name: normalizedStoreName },
        select: {
          id: true,
          name: true,
          tenant: {
            select: { id: true }
          }
        }
      });

      if (!business?.tenant) {
        return { status: 404, message: "No se encontro tenant para la tienda indicada." };
      }

      return {
        status: 200,
        message: "Tenant encontrado.",
        data: {
          tenantId: business.tenant.id,
          businessName: business.name
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en resolveTenantIdByStoreUrl service", {
        message: err?.message,
        stack: err?.stack
      });
      return { status: 500, message: "No se pudo resolver el tenant.", err: err.message };
    }
  }
}

export const businessService = new BusinessService();
