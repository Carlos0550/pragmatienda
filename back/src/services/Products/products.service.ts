import { Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import {
  deletePublicObject,
  getPublicObjectFromDefaultBucket,
  uploadPublicObject
} from "../../storage/minio";
import { PUBLIC_BUCKET } from "../../storage/minio";
import { env } from "../../config/env";
import { generateSecureString } from "../../utils/security.utils";
import { normalizeProductName, normalizeText } from "../../utils/normalization.utils";
import {
  generateProductMetadata,
  generateProductDescription,
  analyzeProductName,
} from "../SEO/seo.service";
import type { z } from "zod";
import type {
  createProductSchema,
  updateProductSchema,
  patchBulkStatusSchema,
  listProductsQuerySchema
} from "./products.zod";
import { ProductsStatus } from "@prisma/client";

type ServiceResponse = { status: number; message: string; data?: unknown; err?: string };

const extractObjectNameFromUrl = (url: string): string | null => {
  try {
    const base = env.MINIO_PUBLIC_URL.replace(/\/$/, "");
    const prefix = `${base}/${PUBLIC_BUCKET}/`;
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
    return null;
  } catch {
    return null;
  }
};

export class ProductsService {
  async create(
    tenantId: string,
    data: z.infer<typeof createProductSchema>,
    file?: Express.Multer.File
  ): Promise<ServiceResponse> {
    try {
      const nameAnalysis = await analyzeProductName(normalizeProductName(data.name));
      logger.info("Name analysis", { nameAnalysis });
      if (nameAnalysis?.isGeneric) {
        return { status: 400, message: nameAnalysis.message };
      }

      const normalizedName = normalizeProductName(data.name);

      const existing = await prisma.products.findUnique({
        where: { tenantId_name: { tenantId, name: normalizedName } }
      });
      if (existing) {
        return { status: 409, message: "Ya existe un producto con ese nombre." };
      }

      let imageUrl: string | undefined;
      if (file?.buffer) {
        const objectName = `productos/${tenantId}/${Date.now()}_${generateSecureString()}.webp`;
        await uploadPublicObject({
          objectName,
          buffer: file.buffer as Buffer,
          contentType: file.mimetype
        });
        imageUrl = getPublicObjectFromDefaultBucket(objectName);
      }

      let description = data.description?.trim();
      if (!description) {
        const generated = await generateProductDescription(normalizeProductName(data.name));
        description = generated ?? undefined;
      }

      let metadata: Record<string, unknown> | undefined = undefined
      const generated = await generateProductMetadata(normalizeProductName(data.name), description);
        if (generated && Object.keys(generated).length > 0) {
          metadata = generated as Record<string, unknown>;
        }

      const product = await prisma.products.create({
        data: {
          tenantId,
          name: normalizedName,
          description,
          image: imageUrl,
          price: data.price,
          stock: data.stock,
          categoryId: data.categoryId || null,
          status: data.status,
          metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined
        }
      });

      return {
        status: 201,
        message: "Producto creado.",
        data: {
          product,
          nameAnalysis: nameAnalysis ?? undefined,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en products create", { message: err.message });
      return { status: 500, message: "Error al crear producto.", err: err.message };
    }
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<z.infer<typeof updateProductSchema>>,
    file?: Express.Multer.File
  ): Promise<ServiceResponse> {
    try {
      const existing = await prisma.products.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return { status: 404, message: "Producto no encontrado." };
      }

      const updatePayload: Record<string, unknown> = {};

      if (data.name !== undefined) {
        const normalizedName = normalizeProductName(data.name);
        const conflict = await prisma.products.findFirst({
          where: {
            tenantId,
            name: normalizedName,
            NOT: { id }
          }
        });
        if (conflict) {
          return { status: 409, message: "Ya existe un producto con ese nombre." };
        }
        updatePayload.name = normalizedName;
      }
      if (data.description !== undefined) updatePayload.description = data.description.trim();
      if (data.price !== undefined) updatePayload.price = data.price;
      if (data.stock !== undefined) updatePayload.stock = data.stock;
      if (data.categoryId !== undefined) updatePayload.categoryId = data.categoryId || null;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.metadata !== undefined) {
        updatePayload.metadata = data.metadata as Prisma.InputJsonValue;
      }

      if (file?.buffer) {
        if (existing.image) {
          const objectName = extractObjectNameFromUrl(existing.image);
          if (objectName) {
            await deletePublicObject(objectName).catch(() => {});
          }
        }
        const objectName = `productos/${tenantId}/${Date.now()}_${generateSecureString()}.webp`;
        await uploadPublicObject({
          objectName,
          buffer: file.buffer as Buffer,
          contentType: file.mimetype
        });
        updatePayload.image = getPublicObjectFromDefaultBucket(objectName);
      }

      if (Object.keys(updatePayload).length === 0) {
        return { status: 400, message: "No hay datos para actualizar." };
      }

      const product = await prisma.products.update({
        where: { id },
        data: updatePayload
      });

      return { status: 200, message: "Producto actualizado.", data: product };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en products update", { message: err.message });
      return { status: 500, message: "Error al actualizar producto.", err: err.message };
    }
  }

  async getMany(
    tenantId: string,
    query: z.infer<typeof listProductsQuerySchema>,
    isPublic: boolean
  ): Promise<ServiceResponse> {
    try {
      const { page, limit, name, categoryId, sortBy, sortOrder } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.ProductsWhereInput = {
        tenantId,
        ...(name?.trim()
          ? { name: { contains: normalizeText(name), mode: "insensitive" as const } }
          : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(isPublic ? {status: ProductsStatus.PUBLISHED, stock: {gt: 0}} : {})
      };

      const orderBy =
        sortBy === "price"
          ? { price: sortOrder }
          : { createdAt: sortOrder };

      const [items, total] = await Promise.all([
        prisma.products.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: { category: { select: { id: true, name: true } } }
        }),
        prisma.products.count({ where })
      ]);

      return {
        status: 200,
        message: "Productos obtenidos.",
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en products getMany", { message: err.message });
      return { status: 500, message: "Error al obtener productos.", err: err.message };
    }
  }

  async deleteBulk(
    ids: string[],
    tenantId: string
  ): Promise<ServiceResponse> {
    try {
      const products = await prisma.products.findMany({
        where: { id: { in: ids }, tenantId },
        select: { id: true, image: true }
      });

      for (const p of products) {
        if (p.image) {
          const objectName = extractObjectNameFromUrl(p.image);
          if (objectName) {
            await deletePublicObject(objectName).catch(() => {});
          }
        }
      }

      const result = await prisma.products.deleteMany({
        where: { id: { in: ids }, tenantId }
      });

      return {
        status: 200,
        message: `${result.count} producto(s) eliminado(s).`,
        data: { deleted: result.count }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en products deleteBulk", { message: err.message });
      return { status: 500, message: "Error al eliminar productos.", err: err.message };
    }
  }

  async patchBulkStatus(
    data: z.infer<typeof patchBulkStatusSchema>,
    tenantId: string
  ): Promise<ServiceResponse> {
    try {
      const result = await prisma.products.updateMany({
        where: { id: { in: data.ids }, tenantId },
        data: { status: data.status as ProductsStatus }
      });

      return {
        status: 200,
        message: `${result.count} producto(s) actualizado(s).`,
        data: { updated: result.count }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en products patchBulkStatus", { message: err.message });
      return { status: 500, message: "Error al actualizar productos.", err: err.message };
    }
  }
}

export const productsService = new ProductsService();
