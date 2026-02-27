import {z} from "zod";

const uploadedFileSchema = z.object({
    fieldname: z.string(),
    originalname: z.string(),
    mimetype: z.string(),
    size: z.number(),
    buffer: z.any()
}).passthrough();

export const createBusinessSchema = z.object({
    name: z.string().min(3).toLowerCase().trim(),
    address: z.string().min(3).toLowerCase().trim(),
    phone: z.string().min(10).max(15).toLowerCase().trim(),
}).strict();

export const createBusinessTenantSchema = createBusinessSchema.extend({
    adminEmail: z.string().email().toLowerCase().trim(),
    adminName: z.string().min(3).toLowerCase().trim()
}).strict();

export const resolveTenantByStoreUrlSchema = z.object({
    url: z.string().min(3).trim()
}).strict();

export const updateBusinessSchema = z.object({
    description: z.string().min(3).optional(),
    address: z.string().min(3).optional(),
    phone: z.string().min(10).max(15).optional(),
    email: z.string().email().optional(),
    logo: uploadedFileSchema.optional(),
    favicon: uploadedFileSchema.optional(),
    banner: uploadedFileSchema.optional(),
    socialMedia: z.array(z.object({
        name: z.string().min(3),
        url: z.string().url()
    })).optional(),
}).strict();

export const loginBusinessSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(8)
}).strict();
