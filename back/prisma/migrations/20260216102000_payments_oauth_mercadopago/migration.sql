-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADOPAGO');

-- CreateTable
CREATE TABLE "store_payment_accounts" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "mp_user_id" TEXT,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT,
  "public_key" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "store_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "external_payment_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "status_detail" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL,
  "raw_response" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_payment_accounts_store_id_idx" ON "store_payment_accounts"("store_id");

-- CreateIndex
CREATE INDEX "store_payment_accounts_provider_idx" ON "store_payment_accounts"("provider");

-- CreateIndex
CREATE INDEX "store_payment_accounts_mp_user_id_idx" ON "store_payment_accounts"("mp_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_payment_accounts_store_id_provider_key" ON "store_payment_accounts"("store_id", "provider");

-- CreateIndex
CREATE INDEX "payments_store_id_idx" ON "payments"("store_id");

-- CreateIndex
CREATE INDEX "payments_external_payment_id_idx" ON "payments"("external_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_external_payment_id_key" ON "payments"("provider", "external_payment_id");

-- AddForeignKey
ALTER TABLE "store_payment_accounts"
ADD CONSTRAINT "store_payment_accounts_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"
ADD CONSTRAINT "payments_store_id_fkey"
FOREIGN KEY ("store_id") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"
ADD CONSTRAINT "payments_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
