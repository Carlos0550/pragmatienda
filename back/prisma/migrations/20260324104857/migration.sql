/*
  Warnings:

  - The values [ANDREANI] on the enum `ShippingProviderCode` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[website]` on the table `BusinessData` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ShippingProviderCode_new" AS ENUM ('CUSTOM_EXTERNAL', 'LOCAL_PICKUP');
ALTER TABLE "ShippingMethod" ALTER COLUMN "providerCode" TYPE "ShippingProviderCode_new" USING ("providerCode"::text::"ShippingProviderCode_new");
ALTER TABLE "ShipmentQuote" ALTER COLUMN "providerCode" TYPE "ShippingProviderCode_new" USING ("providerCode"::text::"ShippingProviderCode_new");
ALTER TABLE "OrderShipment" ALTER COLUMN "providerCode" TYPE "ShippingProviderCode_new" USING ("providerCode"::text::"ShippingProviderCode_new");
ALTER TYPE "ShippingProviderCode" RENAME TO "ShippingProviderCode_old";
ALTER TYPE "ShippingProviderCode_new" RENAME TO "ShippingProviderCode";
DROP TYPE "public"."ShippingProviderCode_old";
COMMIT;

-- AlterTable
ALTER TABLE "BusinessData" ADD COLUMN     "businessHours" TEXT;

-- AlterTable
ALTER TABLE "GuestCart" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GuestCartItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessData_website_key" ON "BusinessData"("website");
