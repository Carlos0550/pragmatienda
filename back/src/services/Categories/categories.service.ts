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
import { normalizeText, slugify } from "../../utils/normalization.utils";
import type { z } from "zod";
import type {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema
} from "./categories.zod";

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

async function getUniqueCategorySlug(
  tenantId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let n = 0;
  for (;;) {
    const existing = await prisma.productsCategory.findFirst({
      where: {
        tenantId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}

export class CategoriesService {
  async getMany(
    tenantId: string,
    query: z.infer<typeof listCategoriesQuerySchema>
  ): Promise<ServiceResponse> {
    try {
      const { page, limit, name } = query;
      const skip = (page - 1) * limit;

      const where = {
        tenantId,
        ...(name?.trim()
          ? { name: { contains: normalizeText(name), mode: "insensitive" as const } }
          : {})
      };

      const [items, total] = await Promise.all([
        prisma.productsCategory.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit
        }),
        prisma.productsCategory.count({ where })
      ]);

      return {
        status: 200,
        message: "Categorías obtenidas.",
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
      logger.error("Error en categories getMany", { message: err.message });
      return { status: 500, message: "Error al obtener categorías.", err: err.message };
    }
  }

  async create(
    tenantId: string,
    data: z.infer<typeof createCategorySchema>,
    file?: Express.Multer.File
  ): Promise<ServiceResponse> {
    try {
      const normalizedName = normalizeText(data.name);
      const slug = await getUniqueCategorySlug(tenantId, slugify(normalizedName));

      const existing = await prisma.productsCategory.findUnique({
        where: { tenantId_name: { tenantId, name: normalizedName } }
      });
      if (existing) {
        return { status: 409, message: "Ya existe una categoría con ese nombre." };
      }

      let imageUrl: string | undefined;
      if (file?.buffer) {
        const objectName = `categories/${tenantId}/${Date.now()}_${generateSecureString()}.webp`;
        await uploadPublicObject({
          objectName,
          buffer: file.buffer as Buffer,
          contentType: file.mimetype
        });
        imageUrl = getPublicObjectFromDefaultBucket(objectName);
      }

      const category = await prisma.productsCategory.create({
        data: {
          tenantId,
          name: normalizedName,
          slug,
          description: data.description?.trim(),
          image: imageUrl,
          metaTitle: data.metaTitle?.trim(),
          metaDescription: data.metaDescription?.trim(),
        }
      });

      return { status: 201, message: "Categoría creada.", data: category };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en categories create", { message: err.message });
      return { status: 500, message: "Error al crear categoría.", err: err.message };
    }
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<z.infer<typeof updateCategorySchema>>,
    file?: Express.Multer.File
  ): Promise<ServiceResponse> {
    try {
      const existing = await prisma.productsCategory.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return { status: 404, message: "Categoría no encontrada." };
      }

      const updatePayload: Record<string, unknown> = {};

      if (data.name !== undefined) {
        const normalizedName = normalizeText(data.name);
        const conflict = await prisma.productsCategory.findFirst({
          where: {
            tenantId,
            name: normalizedName,
            NOT: { id }
          }
        });
        if (conflict) {
          return { status: 409, message: "Ya existe una categoría con ese nombre." };
        }
        updatePayload.name = normalizedName;
        updatePayload.slug = await getUniqueCategorySlug(tenantId, slugify(normalizedName), id);
      } else if (existing.slug == null) {
        updatePayload.slug = await getUniqueCategorySlug(tenantId, slugify(existing.name), id);
      }
      if (data.description !== undefined) {
        updatePayload.description = data.description.trim();
      }
      if (data.metaTitle !== undefined) {
        updatePayload.metaTitle = data.metaTitle.trim();
      }
      if (data.metaDescription !== undefined) {
        updatePayload.metaDescription = data.metaDescription.trim();
      }
      if (file?.buffer) {
        if (existing.image) {
          const objectName = extractObjectNameFromUrl(existing.image);
          if (objectName) {
            await deletePublicObject(objectName).catch(() => {});
          }
        }
        const objectName = `categories/${tenantId}/${Date.now()}_${generateSecureString()}.webp`;
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

      const category = await prisma.productsCategory.update({
        where: { id },
        data: updatePayload
      });

      return { status: 200, message: "Categoría actualizada.", data: category };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en categories update", { message: err.message });
      return { status: 500, message: "Error al actualizar categoría.", err: err.message };
    }
  }

  async delete(id: string, tenantId: string): Promise<ServiceResponse> {
    try {
      const existing = await prisma.productsCategory.findFirst({
        where: { id, tenantId }
      });
      if (!existing) {
        return { status: 404, message: "Categoría no encontrada." };
      }

      if (existing.image) {
        const objectName = extractObjectNameFromUrl(existing.image);
        if (objectName) {
          await deletePublicObject(objectName).catch(() => {});
        }
      }

      await prisma.productsCategory.delete({ where: { id } });
      return { status: 200, message: "Categoría eliminada." };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en categories delete", { message: err.message });
      return { status: 500, message: "Error al eliminar categoría.", err: err.message };
    }
  }

  async getOneBySlug(tenantId: string, slug: string): Promise<ServiceResponse> {
    try {
      const category = await prisma.productsCategory.findFirst({
        where: {
          tenantId,
          slug: slugify(slug),
        },
      });
      if (!category) {
        return { status: 404, message: "Categoría no encontrada." };
      }
      return { status: 200, message: "Categoría obtenida.", data: category };
    } catch (error) {
      const err = error as Error;
      logger.error("Error en categories getOneBySlug", { message: err.message });
      return { status: 500, message: "Error al obtener categoría.", err: err.message };
    }
  }
}

export const categoriesService = new CategoriesService();
