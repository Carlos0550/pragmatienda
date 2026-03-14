UPDATE "BusinessData"
SET "website" = "name"
WHERE "name" IS NOT NULL
  AND btrim("name") <> '';

ALTER TABLE "BusinessData"
ALTER COLUMN "website" SET NOT NULL;

DROP INDEX IF EXISTS "BusinessData_name_key";
