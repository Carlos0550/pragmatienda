import {z} from "zod";

const uploadedFileSchema = z.object({
    fieldname: z.string(),
    originalname: z.string(),
    mimetype: z.string(),
    size: z.number(),
    buffer: z.any()
}).passthrough();

const bankOptionSchema = z.object({
    bankName: z.string().trim().min(2).max(120),
    recipientName: z.string().trim().min(2).max(120),
    aliasCvuCbu: z.string().trim().min(3).max(64)
}).strict();

export const createBusinessSchema = z.object({
    name: z.string().min(3).trim(),
    address: z.string().min(3).trim().optional(),
    province: z.string().min(2).trim().optional(),
    phone: z.string().min(10).max(15).trim(),
}).strict();

export const createBusinessTenantSchema = createBusinessSchema.extend({
    adminEmail: z.string().email().toLowerCase().trim(),
    adminName: z.string().min(3).toLowerCase().trim()
}).strict();

export const resolveTenantByStoreUrlSchema = z.object({
    url: z.string().min(3).trim()
}).strict();

export const checkBusinessNameAvailabilitySchema = z.object({
    website: z.string().min(3).trim()
}).strict();

export const updateBusinessSchema = z.object({
    name: z.string().min(3).optional(),
    website: z.string().min(3).optional(),
    description: z.string().min(3).optional(),
    seoDescription: z.string().min(20).max(220).optional(),
    address: z.string().min(3).optional(),
    province: z.string().min(2).optional(),
    phone: z.string().min(10).max(15).optional(),
    email: z.string().email().optional(),
    logo: uploadedFileSchema.optional(),
    favicon: uploadedFileSchema.optional(),
    banner: uploadedFileSchema.optional(),
    banners: z.array(uploadedFileSchema).max(10).optional(),
    clearLogo: z.union([z.boolean(), z.literal("true"), z.literal("1")]).optional(),
    clearFavicon: z.union([z.boolean(), z.literal("true"), z.literal("1")]).optional(),
    clearSeoImage: z.union([z.boolean(), z.literal("true"), z.literal("1")]).optional(),
    bannerUrls: z.array(z.string().url()).max(20).optional(),
    bannerData: z.array(z.object({
        url: z.string().url(),
        order: z.number().int().min(0),
        objectPositionX: z.number().min(0).max(100).optional(),
        objectPositionY: z.number().min(0).max(100).optional(),
    })).max(20).optional(),
    seoImage: uploadedFileSchema.optional(),
    socialMedia: z.array(z.object({
        name: z.string().min(3),
        url: z.string().url()
    })).optional(),
    bankOptions: z.array(bankOptionSchema).max(20).optional(),
    bannerOverlayPosition: z.enum([
      "bottom-left", "bottom-right", "bottom-center",
      "top-left", "top-right", "top-center",
      "center"
    ]).optional(),
}).strict();

export const loginBusinessSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(8)
}).strict();

export const improveBusinessSeoDescriptionSchema = z.object({
    currentText: z.string().max(400).optional(),
    businessSummary: z.string().min(8).max(300).optional(),
    businessDetails: z.string().min(8).max(300).optional(),
    productsOrServices: z.string().min(8).max(300).optional(),
    shipsNationwide: z.boolean().optional(),
    hasPhysicalStore: z.boolean().optional(),
    physicalStoreLocation: z.string().min(4).max(300).optional(),
}).strict();
