import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { logger } from "../config/logger";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMETYPES.has(file.mimetype.toLowerCase())) {
      cb(new Error("Tipo de archivo no permitido. Solo se admiten JPG, PNG o WEBP."));
      return;
    }
    cb(null, true);
  }
});

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
        .webp()
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

/** Comprobante de pago opcional (campo "comprobante"). Si viene archivo, se procesa. Para exigir comprobante según origen usar requireComprobante. */
export const uploadComprobanteOptionalMiddleware = [
  upload.single("comprobante"),
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
      logger.error("Error en uploadComprobanteOptionalMiddleware: ", err.message);
      return res.status(500).json({ message: "Error al procesar el comprobante." });
    }
  }
];

/** Comprobante de pago requerido (campo "comprobante"). */
export const uploadComprobanteMiddleware = [
  upload.single("comprobante"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Comprobante de pago requerido." });
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
      logger.error("Error en uploadComprobanteMiddleware: ", err.message);
      return res.status(500).json({ message: "Error al procesar el comprobante." });
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
        .webp()
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
    { name: "banners", maxCount: 10 },
    { name: "seoImage", maxCount: 1 },
    { name: "favicon", maxCount: 1 }
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uploadedFiles = (req.files as Record<string, Express.Multer.File[]>) ?? {};
      const fileGroups = ["logo", "banner", "seoImage", "favicon", "banners"] as const;

      for (const group of fileGroups) {
        const files = uploadedFiles[group];
        if (!files?.length) {
          continue;
        }
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          const optimized = await sharp(file.buffer)
            .rotate()
            .toBuffer();

          files[i] = {
            ...file,
            buffer: optimized,
            mimetype: "image/webp",
            originalname: file.originalname.replace(/\.\w+$/, ".webp")
          };
        }
      }

      return next();
    } catch (error) {
      const err = error as Error;
      logger.error("Error catched en uploadBusinessAssetsMiddleware: ", err.message);
      return res.status(500).json({ message: "Error al procesar la imagen." });
    }
  }
];
