-- CreateEnum
CREATE TYPE "ShippingMethodKind" AS ENUM ('THIRD_PARTY', 'EXTERNAL', 'PICKUP');

-- CreateEnum
CREATE TYPE "ShippingProviderCode" AS ENUM ('ANDREANI', 'CUSTOM_EXTERNAL', 'LOCAL_PICKUP');

-- CreateEnum
CREATE TYPE "ShippingQuoteType" AS ENUM ('HOME_DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "OrderShipmentStatus" AS ENUM (
  'DRAFT',
  'QUOTED',
  'PENDING_CREATION',
  'READY_FOR_PICKUP',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELED',
  'FAILED'
);

-- AlterTable
ALTER TABLE "Products"
ADD COLUMN "weightGrams" INTEGER,
ADD COLUMN "lengthCm" DECIMAL(65,30),
ADD COLUMN "widthCm" DECIMAL(65,30),
ADD COLUMN "heightCm" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Order"
DROP COLUMN "shippingCost",
DROP COLUMN "shippingProvider",
DROP COLUMN "shippingService",
DROP COLUMN "trackingCode",
DROP COLUMN "shippingAddress",
DROP COLUMN "shippedAt",
DROP COLUMN "deliveredAt";

-- CreateTable
CREATE TABLE "ShippingMethod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ShippingMethodKind" NOT NULL,
  "providerCode" "ShippingProviderCode" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "availableInCheckout" BOOLEAN NOT NULL DEFAULT true,
  "availableInAdmin" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingZoneRule" (
  "id" TEXT NOT NULL,
  "shippingMethodId" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "locality" TEXT NOT NULL,
  "price" DECIMAL(65,30) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShippingZoneRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentQuote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "shippingMethodId" TEXT NOT NULL,
  "providerCode" "ShippingProviderCode" NOT NULL,
  "quoteType" "ShippingQuoteType" NOT NULL,
  "serviceCode" TEXT,
  "serviceName" TEXT,
  "price" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "destination" JSONB,
  "packageSummary" JSONB,
  "providerPayload" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShipmentQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderShipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "shippingMethodId" TEXT NOT NULL,
  "quoteId" TEXT,
  "providerCode" "ShippingProviderCode" NOT NULL,
  "kind" "ShippingMethodKind" NOT NULL,
  "status" "OrderShipmentStatus" NOT NULL DEFAULT 'DRAFT',
  "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "serviceCode" TEXT,
  "serviceName" TEXT,
  "trackingCode" TEXT,
  "labelUrl" TEXT,
  "externalShipmentId" TEXT,
  "destination" JSONB,
  "originSnapshot" JSONB,
  "pickupSnapshot" JSONB,
  "providerQuotePayload" JSONB,
  "providerShipmentPayload" JSONB,
  "pickedUpAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderShipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingMethod_tenantId_idx" ON "ShippingMethod"("tenantId");
CREATE INDEX "ShippingMethod_providerCode_idx" ON "ShippingMethod"("providerCode");
CREATE INDEX "ShippingMethod_isActive_idx" ON "ShippingMethod"("isActive");

-- CreateIndex
CREATE INDEX "ShippingZoneRule_shippingMethodId_idx" ON "ShippingZoneRule"("shippingMethodId");
CREATE INDEX "ShippingZoneRule_province_locality_idx" ON "ShippingZoneRule"("province", "locality");

-- CreateIndex
CREATE INDEX "ShipmentQuote_tenantId_idx" ON "ShipmentQuote"("tenantId");
CREATE INDEX "ShipmentQuote_shippingMethodId_idx" ON "ShipmentQuote"("shippingMethodId");
CREATE INDEX "ShipmentQuote_providerCode_idx" ON "ShipmentQuote"("providerCode");

-- CreateIndex
CREATE UNIQUE INDEX "OrderShipment_orderId_key" ON "OrderShipment"("orderId");
CREATE UNIQUE INDEX "OrderShipment_quoteId_key" ON "OrderShipment"("quoteId");
CREATE INDEX "OrderShipment_shippingMethodId_idx" ON "OrderShipment"("shippingMethodId");
CREATE INDEX "OrderShipment_providerCode_idx" ON "OrderShipment"("providerCode");
CREATE INDEX "OrderShipment_status_idx" ON "OrderShipment"("status");
CREATE INDEX "OrderShipment_trackingCode_idx" ON "OrderShipment"("trackingCode");

-- AddForeignKey
ALTER TABLE "ShippingMethod"
ADD CONSTRAINT "ShippingMethod_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingZoneRule"
ADD CONSTRAINT "ShippingZoneRule_shippingMethodId_fkey"
FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentQuote"
ADD CONSTRAINT "ShipmentQuote_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentQuote"
ADD CONSTRAINT "ShipmentQuote_shippingMethodId_fkey"
FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipment"
ADD CONSTRAINT "OrderShipment_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipment"
ADD CONSTRAINT "OrderShipment_shippingMethodId_fkey"
FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShipment"
ADD CONSTRAINT "OrderShipment_quoteId_fkey"
FOREIGN KEY ("quoteId") REFERENCES "ShipmentQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
