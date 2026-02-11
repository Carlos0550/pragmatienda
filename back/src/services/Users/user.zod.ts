import { z } from "zod";

export const publicRegisterUserSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(10).max(15).optional()
}).strict();

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
}).strict();

export const updateUserSchema = z.object({
    name: z.string().min(3).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(10).max(15).optional()
}).strict();

export const updateAvatarSchema = z.object({
    avatar: z.any()
}).strict();