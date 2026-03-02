-- AlterTable
ALTER TABLE "BusinessData" ADD COLUMN     "banners" JSONB,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'Argentina',
ADD COLUMN     "mainBanner" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoImage" TEXT;

-- Backfill legacy banner into new fields
UPDATE "BusinessData"
SET
  "mainBanner" = "banner",
  "banners" = jsonb_build_array("banner")
WHERE "banner" IS NOT NULL
  AND "mainBanner" IS NULL;

-- Ensure country default for existing rows
UPDATE "BusinessData"
SET "country" = 'Argentina'
WHERE "country" IS NULL OR btrim("country") = '';
