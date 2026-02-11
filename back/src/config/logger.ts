import type { RequestHandler } from "express";
import winston from "winston";
import { env } from "./env";

const isDev = env.NODE_ENV !== "production";

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true })
);

const devFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaKeys = Object.keys(meta);
    const metaString = metaKeys.length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${message}${metaString}`;
  })
);

const prodFormat = winston.format.combine(baseFormat, winston.format.json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()]
});

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info("HTTP request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip
    });
  });

  next();
};
