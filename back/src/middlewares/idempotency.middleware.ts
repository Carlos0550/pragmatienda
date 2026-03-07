import { createHash } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

const IDEMPOTENCY_HEADER = "idempotency-key";

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(record[key]);
        return acc;
      }, {});
  }
  return value;
};

const summarizeFiles = (req: Request) => {
  if (req.file) {
    return [
      {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    ];
  }

  const files = req.files;
  if (!files) return [];

  if (Array.isArray(files)) {
    return files.map((file) => ({
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));
  }

  return Object.entries(files as Record<string, Express.Multer.File[]>)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([field, group]) =>
      group.map((file) => ({
        fieldname: field,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }))
    );
};

const getRequestHash = (req: Request) => {
  const payload = {
    method: req.method.toUpperCase(),
    path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
    params: sortValue(req.params ?? {}),
    query: sortValue(req.query ?? {}),
    body: sortValue(req.body ?? {}),
    files: summarizeFiles(req)
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

const toSerializable = (body: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue;
};

const resolveExistingRecord = async (
  req: Request,
  res: Response,
  requestHash: string,
  existing: {
    id: string;
    requestHash: string;
    responseStatus: number | null;
    responseBody: Prisma.JsonValue | null;
    expiresAt: Date;
  }
) => {
  const now = new Date();
  if (existing.expiresAt <= now) {
    await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
    return false;
  }

  if (existing.requestHash !== requestHash) {
    res.status(409).json({
      message: "La misma Idempotency-Key fue usada con un payload diferente."
    });
    return true;
  }

  if (existing.responseStatus !== null) {
    if (existing.responseBody === null) {
      res.status(existing.responseStatus).end();
      return true;
    }
    res.status(existing.responseStatus).json(existing.responseBody);
    return true;
  }

  res.status(409).json({
    message: "Ya existe una solicitud en proceso para esta Idempotency-Key."
  });
  return true;
};

export const requireIdempotencyKey = (scope: string, ttlMinutes = 30) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant requerido." });
    }

    const keyRaw = req.header(IDEMPOTENCY_HEADER);
    const key = typeof keyRaw === "string" ? keyRaw.trim() : "";
    if (!key) {
      return res.status(400).json({
        message: "Header Idempotency-Key requerido."
      });
    }
    if (key.length < 8 || key.length > 128) {
      return res.status(400).json({
        message: "Idempotency-Key debe tener entre 8 y 128 caracteres."
      });
    }

    const requestHash = getRequestHash(req);
    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        tenantId_scope_key: {
          tenantId,
          scope,
          key
        }
      },
      select: {
        id: true,
        requestHash: true,
        responseStatus: true,
        responseBody: true,
        expiresAt: true
      }
    });

    if (existing) {
      const handled = await resolveExistingRecord(req, res, requestHash, existing);
      if (handled) {
        return;
      }
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    try {
      const created = await prisma.idempotencyKey.create({
        data: {
          tenantId,
          scope,
          key,
          requestHash,
          expiresAt
        },
        select: { id: true }
      });

      req.idempotency = {
        id: created.id,
        scope,
        key
      };
      return next();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const race = await prisma.idempotencyKey.findUnique({
          where: {
            tenantId_scope_key: {
              tenantId,
              scope,
              key
            }
          },
          select: {
            id: true,
            requestHash: true,
            responseStatus: true,
            responseBody: true,
            expiresAt: true
          }
        });
        if (race) {
          const handled = await resolveExistingRecord(req, res, requestHash, race);
          if (handled) {
            return;
          }
        }
      }

      return res.status(500).json({
        message: "No se pudo procesar la idempotencia de la solicitud."
      });
    }
  };
};

export const persistIdempotencyResponse = async (
  req: Request,
  status: number,
  body: unknown
) => {
  const idempotencyId = req.idempotency?.id;
  if (!idempotencyId) {
    return;
  }

  const responseBody = toSerializable(body);
  await prisma.idempotencyKey.update({
    where: { id: idempotencyId },
    data: {
      responseStatus: status,
      responseBody
    }
  });
};
