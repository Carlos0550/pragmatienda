import { UserStatus } from "@prisma/client";
import { createSessionToken, decryptString, hashString, verifyHash } from "../../config/security";
import { logger } from "../../config/logger";
import { prisma } from "../../db/prisma";
import { sendMail } from "../../mail/mailer";
import { generateSecureString, generateTemporaryPassword } from "../../utils/security.utils";
import { buildPasswordRecoveryEmailHtml, buildWelcomeUserEmailHtml } from "../../utils/template.utils";
import { changePasswordSchema, loginSchema, publicRegisterUserSchema, recoverPasswordSchema, updateUserSchema } from "./user.zod";
import { z } from "zod";

class UserService{
    async publicRegisterUser(
        userData: z.infer<typeof publicRegisterUserSchema>,
        tenantId: string
    ): Promise<ServiceResponse>{
        let createdUser: { id: string; email: string; name: string | null } | null = null;
        try {
            if (!tenantId) {
                return { status: 400, message: "Tenant requerido." };
            }
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { businessData: true }
            });
            if (!tenant) {
                return { status: 404, message: "Tenant no encontrado." };
            }
            if (!tenant.businessData) {
                return { status: 404, message: "Negocio no encontrado para el tenant." };
            }

            const secureString = generateSecureString()
            const securePassword = await hashString(secureString)

            const transactionResult = await prisma.$transaction(async (tx) => {
                const existingUser = await tx.user.findFirst({
                    where: {
                        email: userData.email,
                        tenantId
                    }
                });
                if (existingUser) {
                    return { conflict: true as const };
                }
                const createdUser = await tx.user.create({
                    data:{
                        name: userData.name,
                        email:userData.email,
                        phone: userData.phone ?? "",
                        password: securePassword,
                        role: 2,
                        isVerified: false,
                        status: UserStatus.PENDING,
                        tenantId
                    },
                    select: { id: true, email: true, name: true }
                })

                const cart = await tx.cart.create({
                    data: {
                        userId: createdUser.id,
                        tenantId
                    }
                });

                return { createdUser, cart } as const;
            })
            if (transactionResult.conflict) {
                return { status: 409, message: "El usuario ya existe." };
            }
            createdUser = transactionResult.createdUser;
            const html = await buildWelcomeUserEmailHtml({
                user: {
                    ...createdUser,
                    tenantId
                },
                plainPassword: secureString,
                business: tenant.businessData
            });

            await sendMail({
                to: createdUser.email,
                subject: "Bienvenido a PragmaTienda",
                html
            });

            return {
                status: 200,
                message: "Usuario registrado correctamente, verifique su correo para activar su cuenta."
            }
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en publicRegisterUser service: ",err.message)
            if (createdUser) {
                await prisma.user.delete({ where: { id: createdUser.id } }).catch((cleanupError: unknown) => {
                    logger.error("Error al limpiar usuario creado: ", (cleanupError as Error).message);
                });
            }
            return {
                status: 500,
                message: "Error al registrar el usuario, por favor intente nuevamente.",
                err: err.message
            }
        }
    }

    async verifyAccount(token: string, tenantId?: string | null): Promise<ServiceResponse>{
        try {
            let payloadRaw = "";
            try {
                payloadRaw = decryptString(token);
            } catch {
                return { status: 400, message: "Token de verificacion invalido." };
            }

            let payload: { id?: string; email?: string; tenantId?: string } = {};
            try {
                payload = JSON.parse(payloadRaw) as { id?: string; email?: string; tenantId?: string };
            } catch {
                return { status: 400, message: "Token de verificacion invalido." };
            }
            if (!payload.id || !payload.email) {
                return { status: 400, message: "Token de verificacion invalido." };
            }

            if (tenantId && payload.tenantId && tenantId !== payload.tenantId) {
                return { status: 403, message: "Token no corresponde al tenant indicado." };
            }

            const effectiveTenantId = tenantId ?? payload.tenantId ?? undefined;

            const user = await prisma.user.findFirst({
                where: {
                    id: payload.id,
                    ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {})
                }
            });
            if (!user || user.email !== payload.email) {
                return { status: 404, message: "Usuario no encontrado para este token." };
            }
            if (effectiveTenantId && user.tenantId !== effectiveTenantId) {
                return { status: 403, message: "Usuario no pertenece al tenant." };
            }
            const resolvedTenantId = user.tenantId ?? effectiveTenantId ?? null;
            if (user.isVerified) {
                return { status: 409, message: "La cuenta ya fue verificada.", data: { tenantId: resolvedTenantId } };
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { isVerified: true, status: UserStatus.ACTIVE }
            });

            return { status: 200, message: "Cuenta verificada correctamente.", data: { tenantId: resolvedTenantId } };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en verifyAccount service: ", err.message)
            return { status: 500, message: "No se pudo verificar la cuenta.", err: err.message };
        }
    }

    async login(
        data: z.infer<typeof loginSchema>,
        tenantId?: string | null,
        role = 2
    ): Promise<ServiceResponse>{
        try {
            if (!tenantId) {
                return { status: 400, message: "Tenant requerido." };
            }
            const email = data.email.toLowerCase().trim();
            const password = data.password.trim();
            const users = await prisma.user.findMany({
                where: {
                    email,
                    tenantId,
                    role
                }
            });
            if(users.length === 0){
                return { status: 404, message: "Usuario no encontrado." };
            }
            let matchedUser: (typeof users)[number] | null = null;
            for (const candidate of users) {
                const isPasswordValid = await verifyHash(password, candidate.password);
                if (isPasswordValid) {
                    matchedUser = candidate;
                    break;
                }
            }
            if(!matchedUser){
                return { status: 401, message: "Contraseña incorrecta." };
            }
            if(matchedUser.status !== UserStatus.ACTIVE){
                return { status: 403, message: "Cuenta no activa." };
            }
            if(!matchedUser.isVerified){
                return { status: 403, message: "Cuenta no verificada." };
            }
            const token = await createSessionToken({ id: matchedUser.id, email: matchedUser.email, role: matchedUser.role });
            return { status: 200, message: "Login exitoso.", data: { token } };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en login service: ", err.message)
            return { status: 500, message: "Error al iniciar sesion, por favor intente nuevamente.", err: err.message };
        }
    }

    async getMe(userId: string, tenantId: string): Promise<ServiceResponse>{
        try {
            const user = await prisma.user.findFirst({
                where:{
                    id: userId,
                    tenantId
                },
                select:{
                    name: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    role: true
                }
            })

            if(!user){
                return { status: 404, message: "Usuario no encontrado." };
            }

            return { status: 200, message: "Usuario encontrado.", data: user };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en getMe service: ", err.message)
            return { status: 500, message: "Error al obtener el usuario.", err: err.message };
        }
    }

    async updateMe(
        userId: string,
        tenantId: string,
        data: z.infer<typeof updateUserSchema>
    ): Promise<ServiceResponse>{
        try {
            if (!data.name && !data.email && !data.phone) {
                return { status: 400, message: "No hay datos para actualizar." };
            }
            const existingUser = await prisma.user.findFirst({
                where: { id: userId, tenantId },
                select: { id: true }
            });
            if (!existingUser) {
                return { status: 404, message: "Usuario no encontrado." };
            }
            const user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    ...(data.name ? { name: data.name } : {}),
                    ...(data.email ? { email: data.email } : {}),
                    ...(data.phone !== undefined ? { phone: data.phone } : {})
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                    avatar: true
                }
            });

            return { status: 200, message: "Usuario actualizado.", data: user };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en updateMe service: ", err.message)
            return { status: 500, message: "Error al actualizar el usuario.", err: err.message };
        }
    }

    async updateAvatar(userId: string, tenantId: string, avatarUrl: string): Promise<ServiceResponse>{
        try {
            const existingUser = await prisma.user.findFirst({
                where: { id: userId, tenantId },
                select: { id: true }
            });
            if (!existingUser) {
                return { status: 404, message: "Usuario no encontrado." };
            }
            const user = await prisma.user.update({
                where: { id: existingUser.id },
                data: { avatar: avatarUrl },
                select: {
                    id: true,
                    avatar: true
                }
            });

            return { status: 200, message: "Avatar actualizado.", data: user };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en updateAvatar service: ", err.message)
            return { status: 500, message: "Error al actualizar el avatar.", err: err.message };
        }
    }

    async changePassword(
        userId: string,
        tenantId: string,
        data: z.infer<typeof changePasswordSchema>,
        role = 2
    ): Promise<ServiceResponse> {
        try {
            const user = await prisma.user.findFirst({
                where: {
                    id: userId,
                    tenantId,
                    role
                },
                select: { id: true, password: true }
            });
            if (!user) {
                return { status: 404, message: "Usuario no encontrado." };
            }

            const currentPassword = data.currentPassword.trim();
            const newPassword = data.newPassword.trim();

            const isCurrentPasswordValid = await verifyHash(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return { status: 401, message: "Contraseña actual incorrecta." };
            }

            const isSamePassword = await verifyHash(newPassword, user.password);
            if (isSamePassword) {
                return { status: 400, message: "La nueva contraseña no puede ser igual a la actual." };
            }

            const newPasswordHash = await hashString(newPassword);
            await prisma.user.update({
                where: { id: user.id },
                data: { password: newPasswordHash }
            });

            return { status: 200, message: "Contraseña actualizada correctamente." };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en changePassword service: ", err.message)
            return { status: 500, message: "No se pudo actualizar la contraseña.", err: err.message };
        }
    }

    async recoverPassword(
        tenantId: string,
        data: z.infer<typeof recoverPasswordSchema>,
        role = 2
    ): Promise<ServiceResponse> {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { businessData: true }
            });
            if (!tenant) {
                return { status: 404, message: "Tenant no encontrado." };
            }
            if (!tenant.businessData) {
                return { status: 404, message: "Negocio no encontrado para el tenant." };
            }

            const users = await prisma.user.findMany({
                where: {
                    email: data.email.toLowerCase(),
                    tenantId,
                    role
                },
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            });

            if (users.length === 0) {
                return { status: 200, message: "Si el correo existe, enviaremos instrucciones de recuperación." };
            }

            const temporaryPassword = generateTemporaryPassword(10);
            const passwordHash = await hashString(temporaryPassword);

            await prisma.user.updateMany({
                where: {
                    tenantId,
                    role,
                    id: {
                        in: users.map((user) => user.id)
                    }
                },
                data: { password: passwordHash }
            });

            const html = await buildPasswordRecoveryEmailHtml({
                user: users[0],
                temporaryPassword,
                business: tenant.businessData
            });

            await sendMail({
                to: users[0].email,
                subject: "Recuperacion de contraseña",
                html
            });

            return { status: 200, message: "Si el correo existe, enviaremos instrucciones de recuperación." };
        } catch (error) {
            const err = error as Error
            logger.error("Error catched en recoverPassword service: ", err.message)
            return { status: 500, message: "No se pudo procesar la recuperación de contraseña.", err: err.message };
        }
    }
}

export const userService = new UserService();
