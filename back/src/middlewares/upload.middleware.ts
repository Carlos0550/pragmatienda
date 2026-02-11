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
