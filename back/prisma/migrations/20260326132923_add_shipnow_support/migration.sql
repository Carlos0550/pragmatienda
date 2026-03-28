-- AlterEnum
ALTER TYPE "ShippingProviderCode" ADD VALUE 'SHIPNOW';

-- CreateTable
CREATE TABLE "ShipnowConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipnowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShipnowConfig_tenantId_key" ON "ShipnowConfig"("tenantId");

-- CreateIndex
CREATE INDEX "ShipnowConfig_tenantId_idx" ON "ShipnowConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "ShipnowConfig" ADD CONSTRAINT "ShipnowConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
