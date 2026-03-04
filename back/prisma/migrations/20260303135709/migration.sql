/*
  Warnings:

  - The values [MERCADOPAGO] on the enum `PaymentProvider` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `mainBanner` on the `BusinessData` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProofImage` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProvider` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentReference` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentStatus` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `Order` table. All the data in the column will be lost.

*/
-- AlterEnum: mapear MERCADOPAGO -> MERCADOPAGO_INTEGRATION para que el cast no falle
BEGIN;
CREATE TYPE "PaymentProvider_new" AS ENUM ('MERCADOPAGO_INTEGRATION', 'BANK_TRANSFER', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER');
ALTER TABLE "store_payment_accounts" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING (
  CASE WHEN "provider"::text = 'MERCADOPAGO' THEN 'MERCADOPAGO_INTEGRATION'::"PaymentProvider_new"
  ELSE "provider"::text::"PaymentProvider_new" END
);
ALTER TABLE "payments" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING (
  CASE WHEN "provider"::text = 'MERCADOPAGO' THEN 'MERCADOPAGO_INTEGRATION'::"PaymentProvider_new"
  ELSE "provider"::text::"PaymentProvider_new" END
);
-- No ALTER TABLE "Sales" aquí: la tabla Sales se crea más abajo en esta misma migración
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
DROP TYPE "public"."PaymentProvider_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropIndex
DROP INDEX "Order_paymentProvider_idx";

-- DropIndex
DROP INDEX "Order_paymentStatus_idx";

-- AlterTable
ALTER TABLE "BusinessData" DROP COLUMN "mainBanner";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "currency",
DROP COLUMN "discount",
DROP COLUMN "paidAt",
DROP COLUMN "paymentMethod",
DROP COLUMN "paymentProofImage",
DROP COLUMN "paymentProvider",
DROP COLUMN "paymentReference",
DROP COLUMN "paymentStatus",
DROP COLUMN "subtotal",
DROP COLUMN "total";

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "orderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Sales" (
    "id" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProofImage" TEXT,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "paymentProvider" "PaymentProvider" NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sales_tenantId_idx" ON "Sales"("tenantId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
