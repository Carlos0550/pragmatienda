import type { SessionUserPayload } from "../config/security";

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUserPayload;
    tenantId?: string;
  }
}

export {};
