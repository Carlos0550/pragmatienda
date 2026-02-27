import { PaymentProvider } from "@prisma/client";
import { env } from "../../config/env";
import { encryptString, decryptString } from "../../config/security";
import { logger } from "../../config/logger";
import { PaymentError } from "../domain/payment-errors";
import type { PaymentProvider as PaymentProviderInterface } from "../domain/payment-provider";
import { PaymentProviderRegistry } from "./payment-provider.registry";
import { MercadoPagoProvider } from "../infrastructure/mercadopago.provider";
import { PrismaPaymentsRepository } from "../infrastructure/prisma-payments.repository";

type OAuthStatePayload = {
  storeId: string;
  actorUserId: string;
  provider: "MERCADOPAGO";
  ts: number;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const getWebhookUrl = () => {
  const backend = (env.BACKEND_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${backend}/api/payments/webhooks/mercadopago`;
};

const decodeState = (state: string): OAuthStatePayload => {
  try {
    const decrypted = decryptString(state);
    const payload = JSON.parse(decrypted) as OAuthStatePayload;
    if (!payload?.storeId || !payload?.actorUserId || !payload?.provider || !payload?.ts) {
      throw new Error("invalid payload");
    }
    if (payload.provider !== "MERCADOPAGO") {
      throw new Error("invalid provider");
    }
    if (Date.now() - payload.ts > OAUTH_STATE_TTL_MS) {
      throw new Error("expired state");
    }
    return payload;
  } catch {
    throw new PaymentError(400, "INVALID_STATE", "State de OAuth inválido o expirado.");
  }
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return Number(value.toString());
  }
  return Number(value ?? 0);
};

export class PaymentsService {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly repository: PrismaPaymentsRepository
  ) {}

  async getMercadoPagoConnectUrl(storeId: string, actorUserId: string) {
    const isValidAdminContext = await this.repository.assertAdminContext(storeId, actorUserId);
    if (!isValidAdminContext) {
      throw new PaymentError(403, "UNAUTHORIZED_STORE_CONTEXT", "Usuario no autorizado para conectar pagos.");
    }

    const state = encryptString(
      JSON.stringify({
        storeId,
        actorUserId,
        provider: "MERCADOPAGO",
        ts: Date.now()
      } satisfies OAuthStatePayload)
    );

    const provider = this.registry.get("MERCADOPAGO");
    return provider.connectAccount({
      storeId,
      actorUserId,
      state
    });
  }

  async completeMercadoPagoConnection(code: string, state: string) {
    const payload = decodeState(state);
    const isValidAdminContext = await this.repository.assertAdminContext(
      payload.storeId,
      payload.actorUserId
    );
    if (!isValidAdminContext) {
      throw new PaymentError(
        403,
        "UNAUTHORIZED_STORE_CONTEXT",
        "Contexto inválido para completar la conexión OAuth."
      );
    }

    const provider = this.registry.get("MERCADOPAGO");
    return provider.completeConnection({
      storeId: payload.storeId,
      actorUserId: payload.actorUserId,
      authorizationCode: code
    });
  }

  async createMercadoPagoCheckout(storeId: string, orderId: string, idempotencyKey: string) {
    const order = await this.repository.getOrderForCheckout(storeId, orderId);
    if (!order) {
      throw new PaymentError(404, "ORDER_NOT_FOUND", "Orden no encontrada para checkout.");
    }
    if (!order.items.length) {
      throw new PaymentError(400, "ORDER_NOT_FOUND", "La orden no contiene items para cobrar.");
    }

    const items = order.items.map((item) => ({
      id: item.productId,
      title: item.product?.name ?? `Item ${item.productId}`,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      currency: order.currency,
      image: item.product?.image ?? undefined
    }));

    const provider = this.registry.get("MERCADOPAGO");
    const result = await provider.createCheckout({
      storeId: order.tenantId,
      orderId: order.id,
      amount: toNumber(order.total),
      currency: order.currency,
      payerEmail: order.user?.email,
      items,
      notificationUrl: getWebhookUrl(),
      marketplaceFee: env.MP_MARKETPLACE_FEE,
      idempotencyKey
    });

    logger.info("MercadoPago checkout created", {
      store_id: order.tenantId,
      order_id: order.id
    });

    return result;
  }

  async handleMercadoPagoWebhook(payload: Record<string, unknown>) {
    const action = typeof payload.action === "string" ? payload.action : "";
    const typeRaw =
      typeof payload.type === "string"
        ? payload.type
        : typeof payload.topic === "string"
          ? payload.topic
          : "";
    const paymentIdRaw =
      typeof payload.data === "object" &&
      payload.data !== null &&
      "id" in payload.data
        ? (payload.data as { id?: unknown }).id
        : undefined;
    const paymentId =
      typeof paymentIdRaw === "string" || typeof paymentIdRaw === "number"
        ? String(paymentIdRaw)
        : "";
    const webhookId =
      typeof payload.id === "number" || typeof payload.id === "string"
        ? String(payload.id)
        : `mp-${Date.now()}`;
    const providerUserId =
      typeof payload.user_id === "string" || typeof payload.user_id === "number"
        ? String(payload.user_id)
        : null;

    if (typeRaw.toLowerCase() !== "payment" || !paymentId) {
      throw new PaymentError(400, "INVALID_WEBHOOK", "Webhook de Mercado Pago inválido.");
    }

    logger.info("MercadoPago webhook received", {
      webhook_id: webhookId,
      event_type: typeRaw,
      action
    });

    const provider = this.registry.get("MERCADOPAGO");
    return provider.handleWebhook({
      webhookId,
      eventType: typeRaw,
      paymentId,
      providerUserId
    });
  }

  async refreshMercadoPagoToken(storeId: string) {
    const provider = this.registry.get("MERCADOPAGO");
    return provider.refreshToken({ storeId });
  }

  getOAuthCallbackRedirectUrl(success: boolean) {
    const frontend = env.FRONTEND_URL.replace(/\/$/, "");
    return success
      ? `${frontend}/admin/integrations/mercadopago?status=connected`
      : `${frontend}/admin/integrations/mercadopago?status=error`;
  }

  async getMercadoPagoStatus(storeId: string): Promise<{ connected: boolean }> {
    const account = await this.repository.findStoreAccount(storeId, PaymentProvider.MERCADOPAGO);
    return { connected: !!account };
  }
}

const paymentsRepository = new PrismaPaymentsRepository();
const mercadoPagoProvider = new MercadoPagoProvider(paymentsRepository);
const registry = new PaymentProviderRegistry();
registry.register(mercadoPagoProvider as PaymentProviderInterface);

export const paymentsService = new PaymentsService(registry, paymentsRepository);
