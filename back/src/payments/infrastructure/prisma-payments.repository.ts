import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

type UpsertStoreAccountInput = {
  storeId: string;
  provider: PaymentProvider;
  mpUserId?: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string | null;
  publicKey?: string | null;
  expiresAt?: Date | null;
};

type UpsertPaymentInput = {
  storeId: string;
  orderId: string;
  provider: PaymentProvider;
  externalPaymentId: string;
  status: string;
  statusDetail?: string | null;
  amount: number;
  currency: string;
  rawResponse: Prisma.InputJsonValue;
};

export class PrismaPaymentsRepository {
  async findStoreAccount(storeId: string, provider: PaymentProvider) {
    return prisma.storePaymentAccount.findUnique({
      where: {
        storeId_provider: {
          storeId,
          provider
        }
      }
    });
  }

  async findStoreAccountByMpUserId(mpUserId: string, provider: PaymentProvider) {
    return prisma.storePaymentAccount.findFirst({
      where: {
        mpUserId,
        provider
      }
    });
  }

  async upsertStoreAccount(input: UpsertStoreAccountInput) {
    return prisma.storePaymentAccount.upsert({
      where: {
        storeId_provider: {
          storeId: input.storeId,
          provider: input.provider
        }
      },
      update: {
        mpUserId: input.mpUserId ?? null,
        accessToken: input.accessTokenEncrypted,
        refreshToken: input.refreshTokenEncrypted ?? null,
        publicKey: input.publicKey ?? null,
        expiresAt: input.expiresAt ?? null
      },
      create: {
        storeId: input.storeId,
        provider: input.provider,
        mpUserId: input.mpUserId ?? null,
        accessToken: input.accessTokenEncrypted,
        refreshToken: input.refreshTokenEncrypted ?? null,
        publicKey: input.publicKey ?? null,
        expiresAt: input.expiresAt ?? null
      }
    });
  }

  async upsertPayment(input: UpsertPaymentInput) {
    return prisma.payment.upsert({
      where: {
        provider_externalPaymentId: {
          provider: input.provider,
          externalPaymentId: input.externalPaymentId
        }
      },
      update: {
        storeId: input.storeId,
        orderId: input.orderId,
        status: input.status,
        statusDetail: input.statusDetail ?? null,
        amount: input.amount,
        currency: input.currency,
        rawResponse: input.rawResponse
      },
      create: {
        storeId: input.storeId,
        orderId: input.orderId,
        provider: input.provider,
        externalPaymentId: input.externalPaymentId,
        status: input.status,
        statusDetail: input.statusDetail ?? null,
        amount: input.amount,
        currency: input.currency,
        rawResponse: input.rawResponse
      }
    });
  }

  async findPaymentByExternalPaymentId(
    provider: PaymentProvider,
    externalPaymentId: string
  ) {
    return prisma.payment.findUnique({
      where: {
        provider_externalPaymentId: {
          provider,
          externalPaymentId
        }
      }
    });
  }

  async getOrderForCheckout(storeId: string, orderId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: storeId
      },
      select: {
        id: true,
        tenantId: true,
        currency: true,
        total: true,
        user: {
          select: {
            email: true
          }
        },
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                name: true,
                image: true
              }
            }
          }
        }
      }
    });
  }

  async getOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tenantId: true
      }
    });
  }

  async setOrderPaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    paymentReference?: string | null,
    paymentMethod?: string | null
  ) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus,
        paymentReference: paymentReference ?? null,
        paymentMethod: paymentMethod ?? null,
        ...(paymentStatus === PaymentStatus.PAID ? { paidAt: new Date() } : {})
      }
    });
  }

  async assertAdminContext(storeId: string, actorUserId: string) {
    const admin = await prisma.user.findFirst({
      where: {
        id: actorUserId,
        tenantId: storeId,
        role: 1
      },
      select: {
        id: true
      }
    });
    return Boolean(admin);
  }

  async upsertWebhookEvent(
    storeId: string,
    orderId: string | null,
    provider: string,
    eventId: string,
    eventType: string,
    payload: Prisma.InputJsonValue
  ) {
    return prisma.paymentEvent.upsert({
      where: {
        provider_eventId: {
          provider,
          eventId
        }
      },
      update: {
        orderId,
        eventType,
        payload,
        processedAt: new Date()
      },
      create: {
        tenantId: storeId,
        orderId,
        provider,
        eventId,
        eventType,
        payload
      }
    });
  }
}
