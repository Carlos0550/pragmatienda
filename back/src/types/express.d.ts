import type { SessionUserPayload } from "../config/security";

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUserPayload;
    tenantId?: string;
    guestCartToken?: string;
    idempotency?: {
      id: string;
      scope: string;
      key: string;
    };
  }
}

export {};
