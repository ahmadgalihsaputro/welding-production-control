CREATE TYPE "PartCategory" AS ENUM (
  'Assy',
  'Sub_Assy',
  'Press_Part',
  'Child_Part',
  'Bolt',
  'Nut'
);

ALTER TABLE "ProductionPart"
ALTER COLUMN "type" TYPE "PartCategory"
USING ("type"::TEXT::"PartCategory");
