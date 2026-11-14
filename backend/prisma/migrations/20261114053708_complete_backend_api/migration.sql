/*
  Warnings:

  - Made the column `process` on table `ProductionShiftRecord` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MaterialRequest" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'request',
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "ProductionPart" ADD COLUMN     "cycleGroupId" TEXT,
ADD COLUMN     "cycleTime" DOUBLE PRECISION,
ADD COLUMN     "maxStore" INTEGER;

-- AlterTable
ALTER TABLE "ProductionShiftRecord" ALTER COLUMN "process" SET NOT NULL,
ALTER COLUMN "process" SET DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "ProductionModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routing" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "effectiveDate" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "breakStart" TEXT NOT NULL,
    "breakEnd" TEXT NOT NULL,
    "workHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanConfig" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fields" TEXT[],
    "template" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionModel_code_key" ON "ProductionModel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_code_key" ON "InventoryLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Routing_partNumber_model_version_key" ON "Routing"("partNumber", "model", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftConfig_name_key" ON "ShiftConfig"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KanbanConfig_type_key" ON "KanbanConfig"("type");
