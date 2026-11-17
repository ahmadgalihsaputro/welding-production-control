ALTER TABLE "User"
ADD COLUMN "shiftMode" TEXT NOT NULL DEFAULT 'non_shift',
ADD COLUMN "shiftBase" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "shiftAnchorDate" DATE;

CREATE TABLE "UserPartSkill" (
  "userId" TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  CONSTRAINT "UserPartSkill_pkey" PRIMARY KEY ("userId", "partNumber"),
  CONSTRAINT "UserPartSkill_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserPartSkill_partNumber_fkey" FOREIGN KEY ("partNumber")
    REFERENCES "ProductionPart"("partNumber") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UserPartSkill_partNumber_idx" ON "UserPartSkill"("partNumber");

INSERT INTO "UserPartSkill" ("userId", "partNumber")
SELECT DISTINCT uwa."userId", part."partNumber"
FROM "UserWorkArea" uwa
JOIN "WorkArea" area ON area."id" = uwa."workAreaId"
JOIN "ProductionPart" part
  ON part."line" = area."line"
  AND part."type"::TEXT = area."type"
  AND part."process" = area."process"
ON CONFLICT ("userId", "partNumber") DO NOTHING;

CREATE TABLE "KanbanPartConfig" (
  "id" TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "storeLocation" TEXT NOT NULL,
  "kanbanType" TEXT NOT NULL,
  "nextProcess" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KanbanPartConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KanbanPartConfig_partNumber_fkey" FOREIGN KEY ("partNumber")
    REFERENCES "ProductionPart"("partNumber") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KanbanPartConfig_partNumber_model_key"
ON "KanbanPartConfig"("partNumber", "model");

CREATE INDEX "KanbanPartConfig_partNumber_idx"
ON "KanbanPartConfig"("partNumber");
