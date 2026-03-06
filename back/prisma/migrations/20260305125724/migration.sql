-- DropIndex
DROP INDEX "Products_tenantId_name_key";

-- CreateIndex
CREATE INDEX "Products_barCode_idx" ON "Products"("barCode");

-- CreateIndex
CREATE INDEX "Products_status_idx" ON "Products"("status");

-- CreateIndex
CREATE INDEX "Products_barCode_tenantId_idx" ON "Products"("barCode", "tenantId");

-- CreateIndex
CREATE INDEX "Products_status_tenantId_idx" ON "Products"("status", "tenantId");
