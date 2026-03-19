import compression from "compression";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { logger, requestLogger } from "./config/logger";
import { getSwaggerSpec } from "./docs/swagger";
import { apiRouter } from "./routes";
import { getFrontClientDistDir, platformSitemapHandler, robotsHandler, sitemapHandler, ssrHandler } from "./ssr/renderer";
import { getPlatformBaseUrl } from "./utils/storefront.utils";

const app = express();

const corsOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [getPlatformBaseUrl()];
const corsOriginSet = new Set(corsOrigins);

const cspConnectSrc = ["'self'", "https:", "http:", "wss:", "ws:"];
const platformBaseUrl = getPlatformBaseUrl();
if (platformBaseUrl) cspConnectSrc.push(platformBaseUrl);
if (env.MINIO_PUBLIC_URL) cspConnectSrc.push(env.MINIO_PUBLIC_URL);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        fontSrc: ["'self'", "https:", "data:"],
        imgSrc: ["'self'", "https:", "http:", "data:", "blob:"],
        connectSrc: cspConnectSrc,
      },
    },
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, "");
      callback(null, corsOriginSet.has(normalized));
    }
  })
);
app.use(requestLogger);

app.use("/api", apiRouter);

const swaggerSpec = getSwaggerSpec();
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

const frontClientDistDir = getFrontClientDistDir();
if (fs.existsSync(frontClientDistDir)) {
  app.use(
    express.static(frontClientDistDir, {
      index: false,
      maxAge: env.NODE_ENV === "production" ? "1y" : 0,
      setHeaders: (res, filePath) => {
        const isHtml = path.extname(filePath) === ".html";
        if (isHtml) {
          res.setHeader("Cache-Control", "no-store");
        } else if (env.NODE_ENV === "production") {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
}

app.get("/sitemap.xml", sitemapHandler);
app.get("/sitemap-pages.xml", platformSitemapHandler);
app.get("/robots.txt", robotsHandler);
app.get("*", ssrHandler);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Archivo demasiado grande. Máximo permitido: 5MB." });
    }
    return res.status(400).json({ message: "Error al procesar el archivo subido." });
  }
  if (err.message.includes("Tipo de archivo no permitido")) {
    return res.status(400).json({ message: err.message });
  }
  logger.error("Unhandled error", { err });
  const responseBody =
    env.NODE_ENV === "development"
      ? { message: "Internal server error", error: err.message }
      : { message: "Internal server error" };
  res.status(500).json(responseBody);
  void next;
});

export { app };
