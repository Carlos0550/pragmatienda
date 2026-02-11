import { PlanType, UserStatus } from "@prisma/client";
import { logger } from "../../config/logger";
import { hashString } from "../../config/security";
import { prisma } from "../../db/prisma";
import { generateSecureString } from "../../utils/security.utils";
import { createBusinessTenantSchema } from "./business.zod";
import { z } from "zod";

class BusinessService {
  async createBusinessTenant(data: z.infer<typeof createBusinessTenantSchema>): Promise<ServiceResponse> {
    let createdUserId: string | null = null;
    let createdBusinessId: string | null = null;
    let createdTenantId: string | null = null;

    try {
      const securePassword = await hashString(generateSecureString());

      const adminUser = await prisma.user.create({
        data: {
          name: "Administrador",
          email: data.adminEmail,
          phone: "",
          password: securePassword,
          role: 2,
          isVerified: false,
          status: UserStatus.PENDING
        },
        select: { id: true, email: true }
      });
      createdUserId = adminUser.id;

      const business = await prisma.businessData.create({
        data: {
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone
        }
      });
      createdBusinessId = business.id;

      const tenant = await prisma.tenant.create({
        data: {
          businessId: business.id,
          ownerId: adminUser.id,
          plan: PlanType.FREE
        },
        select: { id: true, plan: true, businessId: true }
      });
      createdTenantId = tenant.id;

      await prisma.user.update({
        where: { id: adminUser.id },
        data: { tenantId: tenant.id }
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
      logger.error("Error catched en createBusinessTenant service: ", err.message);

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
