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
}

export const businessService = new BusinessService();
