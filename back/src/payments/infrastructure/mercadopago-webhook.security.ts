import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";
import { env } from "../../config/env";

const parseSignatureHeader = (header: string) => {
  const parts = header.split(",").map((part) => part.trim());
  const values = new Map<string, string>();
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value) {
      values.set(key, value);
    }
  }
  return {
    ts: values.get("ts") ?? "",
    v1: values.get("v1") ?? ""
  };
};

const safeEqualHex = (a: string, b: string) => {
  try {
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    return timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
};

export const verifyMercadoPagoWebhookSignature = (req: Request): boolean => {
  const secret = env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return true;
  }

  const headerRaw = req.header("x-signature") ?? "";
  const requestId = req.header("x-request-id") ?? "";
  if (!headerRaw || !requestId) {
    return false;
  }

  const dataId =
    typeof req.query["data.id"] === "string"
      ? req.query["data.id"]
      : typeof req.body?.data?.id === "string" || typeof req.body?.data?.id === "number"
        ? String(req.body.data.id)
        : typeof req.query["id"] === "string"
          ? req.query["id"]
          : "";

  const { ts, v1 } = parseSignatureHeader(headerRaw);
  if (!ts || !v1 || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqualHex(expected, v1);
};
