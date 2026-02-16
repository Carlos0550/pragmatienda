import { Router } from "express";
import { z } from "zod";
import { userController } from "../controllers/user.controller";
import { openApiRegistry } from "../docs/swagger";
import {
  changePasswordSchema,
  updateAvatarSchema,
  updateUserSchema
} from "../services/Users/user.zod";
import { requireRole, requireTenant } from "../middlewares";
import { uploadAndConvertImageMiddleware } from "../middlewares/upload.middleware";

openApiRegistry.registerPath({
  method: "get",
  path: "/user/me",
  tags: ["User"],
  summary: "Obtener informacion del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      "Authorization": z.string()
    })
  },
  responses: {}
})

openApiRegistry.registerPath({
  method: "put",
  path: "/user/me",
  tags: ["User"],
  summary: "Actualizar informacion del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      "Authorization": z.string()
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
  path: "/user/me/password",
  tags: ["User"],
  summary: "Cambiar contraseña del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      "Authorization": z.string()
    }),
    body: {
      content: {
        "application/json": {
          schema: changePasswordSchema
        }
      }
    }
  },
  responses: {}
})

openApiRegistry.registerPath({
  method: "put",
  path: "/user/me/avatar",
  tags: ["User"],
  summary: "Actualizar avatar del usuario autenticado",
  request: {
    headers: z.object({
      "x-tenant-id": z.string(),
      "Authorization": z.string()
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

const router = Router();

router.get("/me", requireRole([1, 2]), requireTenant, userController.getMe);
router.put("/me", requireRole([1, 2]), requireTenant, userController.updateMe);
router.put("/me/password", requireRole([1, 2]), requireTenant, userController.changePassword);
router.put("/me/avatar", requireRole([1, 2]), requireTenant, uploadAndConvertImageMiddleware, userController.updateAvatar);

export { router as userRouter };