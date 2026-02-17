process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PORT = process.env.PORT ?? "3001";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
process.env.SECURITY_ENCRYPTION_KEY =
  process.env.SECURITY_ENCRYPTION_KEY ?? "01234567890123456789012345678901";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.MP_CLIENT_ID = process.env.MP_CLIENT_ID ?? "test-client-id";
process.env.MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET ?? "test-client-secret";
process.env.MP_REDIRECT_URI = process.env.MP_REDIRECT_URI ?? "http://localhost:3001/api/payments/mercadopago/callback";
process.env.MP_BILLING_ACCESS_TOKEN = process.env.MP_BILLING_ACCESS_TOKEN ?? "test-billing-token";
process.env.MP_BILLING_SUCCESS_URL =
  process.env.MP_BILLING_SUCCESS_URL ?? "http://localhost:3000/admin/billing";
process.env.BILLING_ALLOW_PAST_DUE = process.env.BILLING_ALLOW_PAST_DUE ?? "false";
