/*
  Warnings:

  - You are about to drop the column `businessId` on the `ProductsCategory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,name]` on the table `ProductsCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProductsStatus" AS ENUM ('PUBLISHED', 'UNPUBLISHED', 'DELETED', 'ARCHIVED', 'LOW_STOCK', 'OUT_OF_STOCK');

-- DropIndex
DROP INDEX "ProductsCategory_businessId_name_key";

-- AlterTable
ALTER TABLE "ProductsCategory" DROP COLUMN "businessId",
ADD COLUMN     "image" TEXT;

-- CreateTable
CREATE TABLE "Products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "price" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER NOT NULL,
    "status" "ProductsStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Products_name_idx" ON "Products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Products_tenantId_name_key" ON "Products"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductsCategory_tenantId_name_key" ON "ProductsCategory"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Products" ADD CONSTRAINT "Products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductsCategory"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
