import { BillingStatus, PlanType, Prisma, UserStatus } from "@prisma/client";
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
  improveBusinessSeoDescriptionSchema,
  loginBusinessSchema,
} from "./business.zod";
import { z } from "zod";
import { buildWelcomeUserEmailHtml } from "../../utils/template.utils";
import { sendMail } from "../../mail/mailer";
import {
  capitalizeWords,
  normalizeText,
  slugify,
  toE164Argentina,
} from "../../utils/normalization.utils";
import { dayjs } from "../../config/dayjs";
import {
  getPublicObjectFromDefaultBucket,
  uploadPublicObject,
} from "../../storage/minio";
import path from "path";
import { updateBusinessSchema } from "./business.zod";
import {
  generateBusinessSeoDescription,
  improveBusinessSeoDescription,
} from "../SEO/seo.service";
import { BillingError } from "../../billing/domain/billing-errors";
import { planCapabilitiesService } from "../../billing/application/plan-capabilities.service";
import {
  getStoreBaseUrl,
  getStoreSubdomainFromInput,
  normalizeStoreSubdomain,
} from "../../utils/storefront.utils";

type BankOption = {
  bankName: string;
  recipientName: string;
  aliasCvuCbu: string;
};

type BusinessBanner = {
  url: string;
  order: number;
  objectPositionX?: number;
  objectPositionY?: number;
};

class BusinessService {
  async checkBusinessNameAvailability(website: string): Promise<ServiceResponse> {
    try {
      const normalizedWebsite = normalizeStoreSubdomain(website);
      if (normalizedWebsite.length < 3) {
        return {
          status: 400,
          message: "Subdominio invalido.",
          data: {
            available: false,
            normalizedWebsite,
          },
        };
      }
      const business = await prisma.businessData.findFirst({
        where: { website: normalizedWebsite },
        select: { id: true }
      });

      return {
        status: 200,
        message: business ? "El subdominio ya existe." : "Subdominio disponible.",
        data: {
          available: !business,
          normalizedWebsite
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en checkBusinessNameAvailability service", {
        message: err?.message,
        stack: err?.stack,
      });

      return {
        status: 500,
        message: "No se pudo validar el subdominio.",
        err: err.message,
      };
    }
  }

  async createBusinessTenant(
    data: z.infer<typeof createBusinessTenantSchema>,
  ): Promise<ServiceResponse> {
    try {
      const bootstrapPassword = `${generateSecureString()}${generateSecureString()}${generateSecureString()}`;
      const securePassword = await hashString(bootstrapPassword);
      const businessName = capitalizeWords(data.name);
      const website = normalizeStoreSubdomain(data.name);
      if (website.length < 3) {
        return { status: 400, message: "No se pudo generar un subdominio valido para el negocio." };
      }
      const generatedSeoDescription = await generateBusinessSeoDescription({
        businessName,
        address: data.address,
        province: data.province,
        country: "Argentina",
      });

      const transactionResult = await prisma.$transaction(async (tx) => {
        const existingBusiness = await tx.businessData.findFirst({
          where: { website },
          select: { id: true },
        });
        if (existingBusiness) {
          return {
            conflict: true as const,
          };
        }

        const freePlan = await tx.plan.findUnique({
          where: { code: PlanType.FREE },
          select: { id: true, code: true }
        });
        if (!freePlan) {
          throw new Error("El plan FREE no está configurado.");
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

        const tenant = await tx.tenant.create({
          data: {
            ownerId: adminUser.id,
            plan: PlanType.FREE,
            billingStatus: BillingStatus.ACTIVE,
            trialEndsAt: null,
            planEndsAt: null
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
            name: businessName,
            website,
            address: data.address ? capitalizeWords(data.address) : undefined,
            province: data.province ? capitalizeWords(data.province) : undefined,
            country: "Argentina",
            seoDescription:
              generatedSeoDescription ??
              `Compra en ${businessName}. Tienda online en Argentina con catálogo actualizado y atención personalizada.`,
            phone: data.phone,
          },
        });

        const freeSubscription = await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: freePlan.id,
            externalSubscriptionId: `free-${tenant.id}`,
            status: BillingStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          select: { id: true }
        });

        await tx.tenant.update({
          where: { id: tenant.id },
          data: { currentSubscriptionId: freeSubscription.id }
        });

        return {
          conflict: false as const,
          adminUser,
          tenant,
          business,
        };
      });
      if (transactionResult.conflict) {
        return { status: 409, message: "El subdominio del negocio ya existe." };
      }

      const { adminUser, tenant, business } = transactionResult;

      const html = await buildWelcomeUserEmailHtml({
        user: {
          ...adminUser,
          tenantId: tenant.id
        },
        business: {
          name: businessName,
          address: data.address ? capitalizeWords(data.address) : "",
          website: getStoreBaseUrl(website),
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");
        const message = error.message.toLowerCase();

        if (target.includes("phone") || message.includes("(`phone`)") || message.includes("phone")) {
          return {
            status: 409,
            message: "Ya existe un negocio con ese teléfono en nuestros registros, por favor ingresa otro.",
          };
        }

        if (target.includes("website") || message.includes("(`website`)") || message.includes("website")) {
          return {
            status: 409,
            message: "Ya existe un negocio con ese subdominio en nuestros registros, por favor ingresa otro.",
          };
        }
      }

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
      const normalizedStoreSubdomain = getStoreSubdomainFromInput(rawUrl);
      if (!normalizedStoreSubdomain) {
        return {
          status: 400,
          message: "La URL no pertenece a un dominio de tienda valido.",
        };
      }
      const business = await prisma.businessData.findFirst({
        where: { website: normalizedStoreSubdomain },
        select: {
          id: true,
          name: true,
          website: true,
          description: true,
          logo: true,
          banner: true,
          banners: true,
          bannerOverlayPosition: true,
          favicon: true,
          seoImage: true,
          seoDescription: true,
          address: true,
          province: true,
          country: true,
          socialMedia: true,
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
          website: business.website,
          storeUrl: getStoreBaseUrl(business.website),
          description: business.description,
          logo: business.logo,
          banner: business.banner,
          banners: business.banners,
          bannerOverlayPosition: business.bannerOverlayPosition,
          favicon: business.favicon,
          seoImage: business.seoImage,
          seoDescription: business.seoDescription ?? business.description,
          address: business.address,
          province: business.province,
          country: business.country,
          socialMedia: business.socialMedia,
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
              website: true,
              description: true,
              seoDescription: true,
              address: true,
              province: true,
              country: true,
              logo: true,
              banner: true,
              banners: true,
              bannerOverlayPosition: true,
              seoImage: true,
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
      const rawBanners = b.banners as BusinessBanner[] | null;
      const slug = b.website || slugify(b.name);
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
      const banners = Array.isArray(rawBanners)
        ? rawBanners
            .filter((item) => item && typeof (item as { url?: string }).url === "string")
            .map((item, index) => {
              const b = item as { url: string; order?: number; objectPositionX?: number; objectPositionY?: number };
              return {
                url: b.url,
                order:
                  typeof b.order === "number" && Number.isFinite(b.order)
                    ? b.order
                    : index,
                objectPositionX: typeof b.objectPositionX === "number" && b.objectPositionX >= 0 && b.objectPositionX <= 100
                  ? b.objectPositionX
                  : 50,
                objectPositionY: typeof b.objectPositionY === "number" && b.objectPositionY >= 0 && b.objectPositionY <= 100
                  ? b.objectPositionY
                  : 50,
              };
            })
        : [];

      return {
        status: 200,
        message: "OK",
        data: {
          id: tenant.id,
          name: b.name,
          website: b.website,
          storeUrl: getStoreBaseUrl(b.website),
          slug,
          description: b.description ?? undefined,
          seoDescription: b.seoDescription ?? b.description ?? undefined,
          address: b.address ?? undefined,
          province: b.province ?? undefined,
          country: b.country ?? "Argentina",
          logo: b.logo ?? undefined,
          banner: b.banner ?? undefined,
          banners,
          bannerOverlayPosition: b.bannerOverlayPosition ?? undefined,
          seoImage: b.seoImage ?? undefined,
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
            select: { id: true, name: true, website: true },
          },
        },
      });
      if (!tenant) {
        return { status: 404, message: "Tenant no encontrado." };
      }
      if (!tenant.businessData) {
        return { status: 404, message: "Negocio no encontrado para el tenant." };
      }
      if (data.website !== undefined) {
        const normalizedWebsite = normalizeStoreSubdomain(data.website);
        if (normalizedWebsite.length < 3) {
          return { status: 400, message: "Subdominio invalido." };
        }
        const existingBusiness = await prisma.businessData.findFirst({
          where: {
            website: normalizedWebsite,
            tenantId: { not: tenantId },
          },
          select: { id: true }
        });
        if (existingBusiness) {
          return { status: 409, message: "El subdominio ya esta en uso por otro negocio." };
        }
      }

      const uploadAsset = async (
        folder: "logos" | "banners" | "favicons" | "seo-images",
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
      const seoImageUrl = await uploadAsset("seo-images", data.seoImage);
      const hasBannerDataPayload = data.bannerData !== undefined && Array.isArray(data.bannerData);
      const hasBannerUrlsPayload = data.bannerUrls !== undefined && Array.isArray(data.bannerUrls);
      const existingBannerUrls = hasBannerUrlsPayload
        ? (data.bannerUrls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0)
        : [];
      const newBannerFiles = Array.isArray(data.banners) ? data.banners : [];
      const uploadedNewBanners = await Promise.all(
        newBannerFiles.map(async (file, index) => {
          const url = await uploadAsset("banners", file);
          if (!url) return null;
          const baseOrder = hasBannerDataPayload
            ? (data.bannerData as { url: string; order: number }[]).length
            : existingBannerUrls.length;
          return {
            url,
            order: baseOrder + index,
            objectPositionX: 50,
            objectPositionY: 50,
          };
        })
      );
      const normalizedNew = uploadedNewBanners.filter(
        (item): item is NonNullable<typeof item> => item != null && Boolean(item.url)
      ) as BusinessBanner[];
      const shouldUpdateBanners = hasBannerDataPayload || hasBannerUrlsPayload || normalizedNew.length > 0;
      let finalBanners: BusinessBanner[];
      if (hasBannerDataPayload) {
        const bannerDataArr = data.bannerData as { url: string; order: number; objectPositionX?: number; objectPositionY?: number }[];
        finalBanners = [
          ...bannerDataArr.map((item) => ({
            url: item.url,
            order: item.order,
            objectPositionX: item.objectPositionX ?? 50,
            objectPositionY: item.objectPositionY ?? 50,
          })),
          ...normalizedNew,
        ];
      } else if (shouldUpdateBanners) {
        finalBanners = [
          ...existingBannerUrls.map((url, order) => ({
            url,
            order,
            objectPositionX: 50,
            objectPositionY: 50,
          })),
          ...normalizedNew,
        ];
      } else {
        finalBanners = [];
      }

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
        ...(data.name ? { name: capitalizeWords(data.name) } : {}),
        ...(data.website ? { website: normalizeStoreSubdomain(data.website) } : {}),
        ...(data.description ? { description: data.description.trim() } : {}),
        ...(data.seoDescription ? { seoDescription: data.seoDescription.trim() } : {}),
        ...(data.address ? { address: data.address.trim() } : {}),
        ...(data.province ? { province: data.province.trim() } : {}),
        ...(data.phone ? { phone: data.phone.trim() } : {}),
        ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
        ...(socialMediaPayload ? { socialMedia: socialMediaPayload } : {}),
        ...(bankOptionsPayload !== undefined ? { bankOptions: bankOptionsPayload } : {}),
        ...(logoUrl ? { logo: logoUrl } : data.clearLogo ? { logo: null } : {}),
        ...(bannerUrl ? { banner: bannerUrl } : {}),
        ...(shouldUpdateBanners ? { banners: finalBanners } : {}),
        ...(data.bannerOverlayPosition !== undefined ? { bannerOverlayPosition: data.bannerOverlayPosition } : {}),
        ...(seoImageUrl ? { seoImage: seoImageUrl } : data.clearSeoImage ? { seoImage: null } : {}),
        ...(faviconUrl ? { favicon: faviconUrl } : data.clearFavicon ? { favicon: null } : {}),
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");
        if (target.includes("website")) {
          return { status: 409, message: "El subdominio ya esta en uso por otro negocio." };
        }
      }
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
      if (user.status !== UserStatus.ACTIVE) {
        return { status: 403, message: "Cuenta no activa." };
      }
      if (!user.isVerified) {
        return { status: 403, message: "Cuenta no verificada." };
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

  async improveSeoDescriptionForTenant(
    tenantId: string,
    input: z.infer<typeof improveBusinessSeoDescriptionSchema>,
  ): Promise<ServiceResponse> {
    try {
      await planCapabilitiesService.assertFeature(tenantId, "seo");

      const business = await prisma.businessData.findUnique({
        where: { tenantId },
        select: {
          name: true,
          address: true,
          province: true,
          country: true,
          seoDescription: true,
        },
      });
      if (!business) {
        return { status: 404, message: "Negocio no encontrado para el tenant." };
      }
      const contextParts = [
        input.businessSummary ? `Qué es el negocio: ${input.businessSummary}` : "",
        input.businessDetails ? `De qué trata: ${input.businessDetails}` : "",
        input.productsOrServices ? `Qué vende/ofrece: ${input.productsOrServices}` : "",
        input.shipsNationwide === true ? "Realiza envíos nacionales: sí." : "",
        input.shipsNationwide === false ? "Realiza envíos nacionales: no." : "",
        input.hasPhysicalStore === true ? "Tiene local físico: sí." : "",
        input.hasPhysicalStore === false ? "Tiene local físico: no." : "",
        input.physicalStoreLocation
          ? `Ubicación del local físico: ${input.physicalStoreLocation}`
          : "",
      ].filter(Boolean);
      const contextText = contextParts.join(" ");
      const baseText = input.currentText?.trim() || business.seoDescription?.trim();
      if (!baseText) {
        const generated = await generateBusinessSeoDescription({
          businessName: business.name,
          address: business.address ?? undefined,
          province: business.province ?? undefined,
          country: business.country || "Argentina",
          extraContext: contextText || undefined,
        });
        if (!generated) {
          return {
            status: 502,
            message: "No se pudo generar la descripción SEO con IA.",
          };
        }
        await prisma.businessData.update({
          where: { tenantId },
          data: { seoDescription: generated },
        });
        return {
          status: 200,
          message: "Descripción SEO generada correctamente.",
          data: { seoDescription: generated },
        };
      }

      const improved = await improveBusinessSeoDescription({
        businessName: business.name,
        address: business.address ?? undefined,
        province: business.province ?? undefined,
        country: business.country || "Argentina",
        currentText: baseText,
        extraContext: contextText || undefined,
      });
      if (!improved) {
        return {
          status: 502,
          message: "No se pudo mejorar la descripción SEO con IA.",
        };
      }

      await prisma.businessData.update({
        where: { tenantId },
        data: { seoDescription: improved },
      });

      return {
        status: 200,
        message: "Descripción SEO mejorada correctamente.",
        data: { seoDescription: improved },
      };
    } catch (error) {
      if (error instanceof BillingError) {
        return {
          status: error.status,
          message: error.message,
          data: error.details,
        };
      }

      const err = error as Error;
      logger.error("Error catched en improveSeoDescriptionForTenant service", {
        message: err?.message,
        stack: err?.stack,
      });
      return {
        status: 500,
        message: "No se pudo mejorar la descripción SEO.",
        err: err.message,
      };
    }
  }
}

export const businessService = new BusinessService();
