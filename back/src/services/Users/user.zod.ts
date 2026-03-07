import { z } from "zod";

const optionalPhone = z.preprocess(
  (val) => (val === "" || val == null ? undefined : val),
  z.string().min(10).max(15).optional()
);

export const publicRegisterUserSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: optionalPhone,
    password: z.string().min(8),
    passwordConfirmation: z.string().min(8)
}).strict().refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"]
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
}).strict();

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
}).strict();

export const recoverPasswordSchema = z.object({
    email: z.string().email()
}).strict();

export const validatePasswordTokenSchema = z.object({
    token: z.string().min(16)
}).strict();

export const resetPasswordWithTokenSchema = z.object({
    token: z.string().min(16),
    newPassword: z.string().min(8),
    newPasswordConfirmation: z.string().min(8)
}).strict().refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["newPasswordConfirmation"]
});

export const updateUserSchema = z.object({
    name: z.string().min(3).optional(),
    email: z.string().email().optional(),
    phone: optionalPhone
}).strict();

export const updateAvatarSchema = z.object({
    image: z.any()
}).strict();
