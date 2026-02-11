-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_businessId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
