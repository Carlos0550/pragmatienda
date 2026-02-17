export type PaymentAccountTokens = {
  accessToken: string;
  refreshToken?: string | null;
  publicKey?: string | null;
  expiresAt?: Date | null;
  providerUserId?: string | null;
};

export type ConnectAccountInput = {
  storeId: string;
  actorUserId: string;
  state: string;
};

export type ConnectAccountResult = {
  authorizationUrl: string;
};

export type ConnectCallbackInput = {
  storeId: string;
  actorUserId: string;
  authorizationCode: string;
};

export type ConnectCallbackResult = {
  storeId: string;
  providerUserId: string | null;
};

export type CheckoutItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  image?: string | null;
};

export type CreateCheckoutInput = {
  storeId: string;
  orderId: string;
  amount: number;
  currency: string;
  payerEmail?: string | null;
  items: CheckoutItem[];
  notificationUrl: string;
  marketplaceFee?: number;
  idempotencyKey: string;
};

export type CreateCheckoutResult = {
  externalReference: string;
  checkoutUrl: string;
  preferenceId: string;
};

export type HandleWebhookInput = {
  webhookId: string;
  eventType: string;
  paymentId: string;
  providerUserId?: string | null;
};

export type HandleWebhookResult = {
  storeId: string;
  orderId: string;
  paymentId: string;
};

export type RefreshTokenInput = {
  storeId: string;
};

export type RefreshTokenResult = {
  refreshed: boolean;
};

export interface PaymentProvider {
  readonly providerCode: "MERCADOPAGO";
  connectAccount(input: ConnectAccountInput): Promise<ConnectAccountResult>;
  completeConnection(input: ConnectCallbackInput): Promise<ConnectCallbackResult>;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>;
  refreshToken(input: RefreshTokenInput): Promise<RefreshTokenResult>;
}
