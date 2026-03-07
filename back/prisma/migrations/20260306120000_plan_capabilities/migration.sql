-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "maxProducts" INTEGER,
ADD COLUMN "maxCategories" INTEGER,
ADD COLUMN "features" JSONB;
