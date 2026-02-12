import {z} from "zod";

export const createBusinessSchema = z.object({
    name: z.string().min(3).toLowerCase().trim(),
    description: z.string().optional(),
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
    name: z.string().min(3).optional(),
    description: z.string().min(3).optional(),
    address: z.string().min(3).optional(),
    phone: z.string().min(10).max(15).optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    logo: z.string().url().optional(),
    favicon: z.string().url().optional(),
    banner: z.string().url().optional(),
    socialMedia: z.array(z.object({
        name: z.string().min(3),
        url: z.string().url()
    })).optional(),
}).strict();