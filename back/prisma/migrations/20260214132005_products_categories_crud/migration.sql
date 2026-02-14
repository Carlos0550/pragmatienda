-- DropIndex
DROP INDEX "ProductsCategory_name_key";

-- DropIndex
DROP INDEX "ProductsCategory_tenantId_key";

-- AlterTable
ALTER TABLE "Products" ADD COLUMN     "image" TEXT,
ALTER COLUMN "categoryId" DROP NOT NULL;
