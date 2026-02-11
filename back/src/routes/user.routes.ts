import { Router } from "express";
import { z } from "zod";
import { userController } from "../controllers/user.controller";
import { openApiRegistry } from "../docs/swagger";
import {
  loginSchema,
  publicRegisterUserSchema,
  updateAvatarSchema,
  updateUserSchema
} from "../services/Users/user.zod";
import { requireRole, requireTenant } from "../middlewares";
import { uploadAndConvertImageMiddleware } from "../middlewares/upload.middleware";

openApiRegistry.registerPath({
  method: "post",
  path: "/public/register",
  tags: ["User"],
  summary: "Registro publico de usuario",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: publicRegisterUserSchema
        }
      }
    }
  },
  responses: {}
});

openApiRegistry.registerPath({
  method: "post",
  path: "/public/login",
  tags: ["User"],
  summary: "Inicio de sesion publico",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: loginSchema
        }
      }
    }
  },
  responses: {}
})

openApiRegistry.registerPath({
  method: "get",
  path: "/me",
  tags: ["User"],
  summary: "Obtener informacion del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    })
  },
  responses: {}
})

openApiRegistry.registerPath({
  method: "put",
  path: "/me",
  tags: ["User"],
  summary: "Actualizar informacion del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: updateUserSchema
        }
      }
    }
  },
  responses: {}
})

openApiRegistry.registerPath({
  method: "put",
  path: "/me/avatar",
  tags: ["User"],
  summary: "Actualizar avatar del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string()
    }),
    body: {
      content: {
        "multipart/form-data": {
          schema: updateAvatarSchema
        }
      }
    }
  },
  responses: {}
})

const router = Router()

router.post("/public/register", requireTenant, userController.publicRegisterUser)
router.post("/public/login", requireTenant, userController.login)
router.get("/public/verify", requireTenant, userController.verifyAccount)
router.get("/me", requireRole([1,2]), requireTenant, userController.getMe)
router.put("/me", requireRole([1,2]), requireTenant, userController.updateMe)
router.put("/me/avatar", requireRole([1,2]), requireTenant, uploadAndConvertImageMiddleware, userController.updateAvatar)

export { router as userRouter };