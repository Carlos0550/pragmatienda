import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { logger } from "../config/logger";

const upload = multer({ storage: multer.memoryStorage() });

export const uploadAndConvertImageMiddleware = [
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Archivo de imagen requerido." });
      }

      const optimized = await sharp(req.file.buffer)
        .rotate()
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      req.file = {
        ...req.file,
        buffer: optimized,
        mimetype: "image/webp",
        originalname: req.file.originalname.replace(/\.\w+$/, ".webp")
      };

      return next();
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en uploadAndConvertImageMiddleware: ", err.message);
      return res.status(500).json({ message: "Error al procesar la imagen." });
    }
  }
];

/** Imagen opcional: procesa si viene, sigue si no. */
export const uploadAndConvertImageOptionalMiddleware = [
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return next();

      const optimized = await sharp(req.file.buffer)
        .rotate()
        .resize(512, 512, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      req.file = {
        ...req.file,
        buffer: optimized,
        mimetype: "image/webp",
        originalname: req.file.originalname.replace(/\.\w+$/, ".webp")
      };

      return next();
    } catch (error) {
      const err = error as Error;
      logger.error("Error en uploadAndConvertImageOptionalMiddleware: ", err.message);
      return res.status(500).json({ message: "Error al procesar la imagen." });
    }
  }
];

export const uploadBusinessAssetsMiddleware = [
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "favicon", maxCount: 1 }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uploadedFiles = (req.files as Record<string, Express.Multer.File[]>) ?? {};
      const fileGroups = ["logo", "banner", "favicon"] as const;

      for (const group of fileGroups) {
        const file = uploadedFiles[group]?.[0];
        if (!file) {
          continue;
        }

        const optimized = await sharp(file.buffer)
          .rotate()
          .resize(512, 512, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();

        uploadedFiles[group][0] = {
          ...file,
          buffer: optimized,
          mimetype: "image/webp",
          originalname: file.originalname.replace(/\.\w+$/, ".webp")
        };
      }

      return next();
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en uploadBusinessAssetsMiddleware: ", err.message);
      return res.status(500).json({ message: "Error al procesar la imagen." });
    }
  }
];
