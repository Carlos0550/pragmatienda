import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanFromString = z.preprocess((value) => {
  if (value === "true" || value === true) {
    return true;
  }
  if (value === "false" || value === false) {
    return false;
  }
  return value;
}, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  CORS_ORIGIN: z.string().optional(),
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: booleanFromString.default(false),
  MINIO_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  MINIO_SECRET_KEY: z.string().min(1).default("minioadmin"),
  MINIO_REGION: z.string().optional(),
  MINIO_PUBLIC_URL: z.string().optional(),
  MAIL_PROVIDER: z.enum(["resend", "ethereal"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().min(1).default("no-reply@example.com"),
  SECURITY_ENCRYPTION_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET es requerido"),
  FRONTEND_URL: z.string().min(1).default("http://localhost:3000"),
  BACKEND_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional()
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Config invalida:", parsed.error.flatten().fieldErrors);
  throw new Error("Variables de entorno invalidas");
}

const data = parsed.data;
const mailProvider =
  data.MAIL_PROVIDER ?? (data.NODE_ENV === "production" ? "resend" : "ethereal");
const minioPublicUrl =
  data.MINIO_PUBLIC_URL ??
  `http${data.MINIO_USE_SSL ? "s" : ""}://${data.MINIO_ENDPOINT}:${data.MINIO_PORT}`;

export const env = {
  ...data,
  MAIL_PROVIDER: mailProvider,
  MINIO_PUBLIC_URL: minioPublicUrl
};
