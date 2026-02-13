/*
  Warnings:

  - You are about to drop the column `businessId` on the `Tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId]` on the table `BusinessData` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `BusinessData` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_businessId_fkey";

-- DropIndex
DROP INDEX "Tenant_businessId_key";

-- AlterTable
ALTER TABLE "BusinessData" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "businessId";

-- CreateTable
CREATE TABLE "ProductsCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "businessId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductsCategory_tenantId_key" ON "ProductsCategory"("tenantId");

-- CreateIndex
CREATE INDEX "ProductsCategory_name_idx" ON "ProductsCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductsCategory_name_key" ON "ProductsCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductsCategory_businessId_name_key" ON "ProductsCategory"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessData_tenantId_key" ON "BusinessData"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_key" ON "User"("tenantId");

-- AddForeignKey
ALTER TABLE "BusinessData" ADD CONSTRAINT "BusinessData_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductsCategory" ADD CONSTRAINT "ProductsCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
