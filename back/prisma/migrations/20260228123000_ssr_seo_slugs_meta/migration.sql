-- ProductsCategory SEO fields
ALTER TABLE "ProductsCategory"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "metaTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- Products SEO fields
ALTER TABLE "Products"
  ADD COLUMN IF NOT EXISTS "metaTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- Backfill category slug when missing
WITH base AS (
  SELECT
    id,
    "tenantId",
    COALESCE(
      NULLIF(
        TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g')),
        ''
      ),
      'categoria'
    ) AS base_slug
  FROM "ProductsCategory"
  WHERE slug IS NULL OR slug = ''
),
ranked AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY "tenantId", base_slug ORDER BY id) AS rn
  FROM base
)
UPDATE "ProductsCategory" c
SET slug = CASE WHEN ranked.rn = 1 THEN ranked.base_slug ELSE ranked.base_slug || '-' || (ranked.rn - 1)::text END
FROM ranked
WHERE c.id = ranked.id;

-- Backfill product slug when missing
WITH base AS (
  SELECT
    id,
    "tenantId",
    COALESCE(
      NULLIF(
        TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g')),
        ''
      ),
      'producto'
    ) AS base_slug
  FROM "Products"
  WHERE slug IS NULL OR slug = ''
),
ranked AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY "tenantId", base_slug ORDER BY id) AS rn
  FROM base
)
UPDATE "Products" p
SET slug = CASE WHEN ranked.rn = 1 THEN ranked.base_slug ELSE ranked.base_slug || '-' || (ranked.rn - 1)::text END
FROM ranked
WHERE p.id = ranked.id;

-- Resolve duplicate category slugs by tenant before unique index
WITH duplicated AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY "tenantId", slug ORDER BY id) AS rn
  FROM "ProductsCategory"
  WHERE slug IS NOT NULL
)
UPDATE "ProductsCategory" c
SET slug = c.slug || '-' || (duplicated.rn - 1)::text
FROM duplicated
WHERE c.id = duplicated.id
  AND duplicated.rn > 1;

-- Resolve duplicate product slugs by tenant before unique index
WITH duplicated AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY "tenantId", slug ORDER BY id) AS rn
  FROM "Products"
  WHERE slug IS NOT NULL
)
UPDATE "Products" p
SET slug = p.slug || '-' || (duplicated.rn - 1)::text
FROM duplicated
WHERE p.id = duplicated.id
  AND duplicated.rn > 1;

CREATE INDEX IF NOT EXISTS "Products_slug_idx" ON "Products"("slug");
CREATE INDEX IF NOT EXISTS "ProductsCategory_slug_idx" ON "ProductsCategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Products_tenantId_slug_key" ON "Products"("tenantId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductsCategory_tenantId_slug_key" ON "ProductsCategory"("tenantId", "slug");
