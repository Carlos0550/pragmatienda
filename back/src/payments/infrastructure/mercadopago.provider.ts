import { PaymentProvider as PaymentProviderEnum, Prisma } from "@prisma/client";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { env } from "../../config/env";
import { decryptString, encryptString } from "../../config/security";
import { logger } from "../../config/logger";
import type {
  ConnectAccountInput,
  ConnectAccountResult,
  ConnectCallbackInput,
  ConnectCallbackResult,
  CreateCheckoutInput,
  CreateCheckoutResult,
  HandleWebhookInput,
  HandleWebhookResult,
  PaymentProvider,
  RefreshTokenInput,
  RefreshTokenResult
} from "../domain/payment-provider";
import { PaymentError } from "../domain/payment-errors";
import {
  mapMercadoPagoStatusToOrderPaymentStatus,
  mapMercadoPagoStatusToPublicPaymentStatus
} from "../domain/payment-status.mapper";
import { PrismaPaymentsRepository } from "./prisma-payments.repository";

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  user_id?: number;
  public_key?: string;
  expires_in?: number;
};

const OAUTH_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
const OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

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

const buildWebhookEventId = (eventType: string, paymentId: string, webhookId: string) =>
  `${eventType}:${paymentId}:${webhookId || "unknown"}`;

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export class MercadoPagoProvider implements PaymentProvider {
  readonly providerCode = "MERCADOPAGO" as const;

  constructor(private readonly repository: PrismaPaymentsRepository) {}

  private assertConfig() {
    if (!env.MP_CLIENT_ID || !env.MP_CLIENT_SECRET || !env.MP_REDIRECT_URI) {
      throw new PaymentError(
        500,
        "CONFIG_ERROR",
        "Mercado Pago no está configurado correctamente."
      );
    }
  }

  async connectAccount(input: ConnectAccountInput): Promise<ConnectAccountResult> {
    this.assertConfig();

    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.MP_CLIENT_ID as string,
      redirect_uri: env.MP_REDIRECT_URI as string,
      state: input.state
    });

    return {
      authorizationUrl: `${OAUTH_AUTHORIZE_URL}?${params.toString()}`
    };
  }

  private async exchangeAuthorizationCode(code: string): Promise<OAuthTokenResponse> {
    this.assertConfig();
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: env.MP_CLIENT_ID,
        client_secret: env.MP_CLIENT_SECRET,
        code,
        redirect_uri: env.MP_REDIRECT_URI
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new PaymentError(502, "PROVIDER_ERROR", "Falló OAuth con Mercado Pago.", {
        status: response.status,
        body
      });
    }

    return (await response.json()) as OAuthTokenResponse;
  }

  private async refreshMercadoPagoToken(refreshToken: string): Promise<OAuthTokenResponse> {
    this.assertConfig();
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: env.MP_CLIENT_ID,
        client_secret: env.MP_CLIENT_SECRET,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new PaymentError(502, "PROVIDER_ERROR", "No se pudo refrescar token de Mercado Pago.", {
        status: response.status,
        body
      });
    }

    return (await response.json()) as OAuthTokenResponse;
  }

  async completeConnection(input: ConnectCallbackInput): Promise<ConnectCallbackResult> {
    const tokens = await this.exchangeAuthorizationCode(input.authorizationCode);

    if (!tokens.access_token) {
      throw new PaymentError(502, "PROVIDER_ERROR", "Mercado Pago no devolvió access_token.");
    }

    const expiresAt =
      typeof tokens.expires_in === "number" ? new Date(Date.now() + tokens.expires_in * 1000) : null;

    await this.repository.upsertStoreAccount({
      storeId: input.storeId,
      provider: PaymentProviderEnum.MERCADOPAGO,
      mpUserId: tokens.user_id ? String(tokens.user_id) : null,
      accessTokenEncrypted: encryptString(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encryptString(tokens.refresh_token) : null,
      publicKey: tokens.public_key ?? null,
      expiresAt
    });

    logger.info("MercadoPago account connected", {
      storeId: input.storeId,
      actorUserId: input.actorUserId,
      provider: this.providerCode
    });

    return {
      storeId: input.storeId,
      providerUserId: tokens.user_id ? String(tokens.user_id) : null
    };
  }

  private async getStoreAccessToken(storeId: string): Promise<string> {
    const account = await this.repository.findStoreAccount(storeId, PaymentProviderEnum.MERCADOPAGO);
    if (!account) {
      throw new PaymentError(404, "ACCOUNT_NOT_CONNECTED", "La tienda no tiene Mercado Pago conectado.");
    }

    const shouldRefresh =
      Boolean(account.expiresAt) &&
      account.expiresAt!.getTime() <= Date.now() + TOKEN_REFRESH_MARGIN_MS;

    if (!shouldRefresh) {
      return decryptString(account.accessToken);
    }

    if (!account.refreshToken) {
      return decryptString(account.accessToken);
    }

    const refreshed = await this.refreshMercadoPagoToken(decryptString(account.refreshToken));
    if (!refreshed.access_token) {
      throw new PaymentError(502, "PROVIDER_ERROR", "Mercado Pago no devolvió access_token al refrescar.");
    }

    const refreshedExpiresAt =
      typeof refreshed.expires_in === "number"
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : account.expiresAt;

    await this.repository.upsertStoreAccount({
      storeId,
      provider: PaymentProviderEnum.MERCADOPAGO,
      mpUserId: refreshed.user_id ? String(refreshed.user_id) : account.mpUserId,
      accessTokenEncrypted: encryptString(refreshed.access_token),
      refreshTokenEncrypted: refreshed.refresh_token
        ? encryptString(refreshed.refresh_token)
        : account.refreshToken,
      publicKey: refreshed.public_key ?? account.publicKey,
      expiresAt: refreshedExpiresAt
    });

    return refreshed.access_token;
  }

  async refreshToken(input: RefreshTokenInput): Promise<RefreshTokenResult> {
    const account = await this.repository.findStoreAccount(input.storeId, PaymentProviderEnum.MERCADOPAGO);
    if (!account || !account.refreshToken) {
      return { refreshed: false };
    }

    const refreshed = await this.refreshMercadoPagoToken(decryptString(account.refreshToken));
    if (!refreshed.access_token) {
      return { refreshed: false };
    }

    const refreshedExpiresAt =
      typeof refreshed.expires_in === "number"
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : account.expiresAt;

    await this.repository.upsertStoreAccount({
      storeId: input.storeId,
      provider: PaymentProviderEnum.MERCADOPAGO,
      mpUserId: refreshed.user_id ? String(refreshed.user_id) : account.mpUserId,
      accessTokenEncrypted: encryptString(refreshed.access_token),
      refreshTokenEncrypted: refreshed.refresh_token
        ? encryptString(refreshed.refresh_token)
        : account.refreshToken,
      publicKey: refreshed.public_key ?? account.publicKey,
      expiresAt: refreshedExpiresAt
    });

    return { refreshed: true };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const accessToken = await this.getStoreAccessToken(input.storeId);
    const client = new MercadoPagoConfig({
      accessToken
    });

    const preference = new Preference(client);
    const preferenceResponse = await preference.create({
      body: {
        external_reference: input.orderId,
        notification_url: input.notificationUrl,
        marketplace_fee: input.marketplaceFee,
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
        items: input.items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: item.currency,
          picture_url: item.image ?? undefined
        }))
      },
      requestOptions: {
        idempotencyKey: input.idempotencyKey
      }
    });

    const checkoutUrl = preferenceResponse.init_point ?? preferenceResponse.sandbox_init_point;
    const preferenceId = preferenceResponse.id;
    if (!checkoutUrl || !preferenceId) {
      throw new PaymentError(502, "PROVIDER_ERROR", "Mercado Pago no devolvió una preferencia válida.");
    }

    return {
      externalReference: input.orderId,
      checkoutUrl,
      preferenceId
    };
  }

  async handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult> {
    if ((input.eventType ?? "").toLowerCase() !== "payment") {
      throw new PaymentError(400, "INVALID_WEBHOOK", "Evento no soportado por webhook.");
    }
    if (!input.paymentId) {
      throw new PaymentError(400, "INVALID_WEBHOOK", "payment_id requerido.");
    }

    let account = input.providerUserId
      ? await this.repository.findStoreAccountByMpUserId(
          input.providerUserId,
          PaymentProviderEnum.MERCADOPAGO
        )
      : null;

    if (!account) {
      const existingPayment = await this.repository.findPaymentByExternalPaymentId(
        PaymentProviderEnum.MERCADOPAGO,
        input.paymentId
      );
      if (existingPayment) {
        account = await this.repository.findStoreAccount(
          existingPayment.storeId,
          PaymentProviderEnum.MERCADOPAGO
        );
      }
    }

    if (!account) {
      throw new PaymentError(
        404,
        "ACCOUNT_NOT_CONNECTED",
        "No se encontró cuenta de Mercado Pago para este webhook."
      );
    }

    const accessToken = await this.getStoreAccessToken(account.storeId);
    const paymentClient = new Payment(
      new MercadoPagoConfig({
        accessToken
      })
    );

    const payment = await paymentClient.get({
      id: input.paymentId
    });

    const orderId = payment.external_reference ?? "";
    if (!orderId) {
      throw new PaymentError(
        400,
        "INVALID_WEBHOOK",
        "El pago no tiene external_reference para asociar orden."
      );
    }

    const order = await this.repository.getOrderById(orderId);
    if (!order || order.tenantId !== account.storeId) {
      throw new PaymentError(404, "ORDER_NOT_FOUND", "Orden no encontrada para el store del webhook.");
    }

    const eventId = buildWebhookEventId(input.eventType, input.paymentId, input.webhookId);
    await this.repository.upsertWebhookEvent(
      order.tenantId,
      order.id,
      this.providerCode,
      eventId,
      input.eventType,
      toInputJson(payment)
    );

    await this.repository.upsertPayment({
      storeId: order.tenantId,
      orderId: order.id,
      provider: PaymentProviderEnum.MERCADOPAGO,
      externalPaymentId: String(payment.id ?? input.paymentId),
      status: mapMercadoPagoStatusToPublicPaymentStatus(payment.status),
      statusDetail: payment.status_detail ?? null,
      amount: toNumber(payment.transaction_amount),
      currency: payment.currency_id ?? "ARS",
      rawResponse: toInputJson(payment)
    });

    await this.repository.setOrderPaymentStatus(
      order.id,
      mapMercadoPagoStatusToOrderPaymentStatus(payment.status),
      payment.id ? String(payment.id) : null,
      payment.payment_method_id ?? null
    );

    logger.info("MercadoPago webhook processed", {
      store_id: order.tenantId,
      order_id: order.id,
      payment_id: String(payment.id ?? input.paymentId)
    });

    return {
      storeId: order.tenantId,
      orderId: order.id,
      paymentId: String(payment.id ?? input.paymentId)
    };
  }
}
