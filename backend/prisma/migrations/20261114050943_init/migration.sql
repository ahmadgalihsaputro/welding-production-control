-- CreateEnum
CREATE TYPE "Role" AS ENUM ('operator_assy', 'operator_sub_assy', 'operator_both', 'leader', 'admin', 'management');

-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('Assy', 'Sub_Assy');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('waiting', 'running', 'complete');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'allocated');

-- CreateEnum
CREATE TYPE "ShiftNumber" AS ENUM ('ONE', 'TWO');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('safe', 'low', 'full', 'empty');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLogin" TIMESTAMP(3),
    "initials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkArea" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "process" TEXT NOT NULL,

    CONSTRAINT "WorkArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorkArea" (
    "userId" TEXT NOT NULL,
    "workAreaId" TEXT NOT NULL,

    CONSTRAINT "UserWorkArea_pkey" PRIMARY KEY ("userId","workAreaId")
);

-- CreateTable
CREATE TABLE "ProductionPart" (
    "partNumber" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "process" TEXT NOT NULL,
    "models" TEXT[],
    "packaging" INTEGER,
    "placeholder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPart_pkey" PRIMARY KEY ("partNumber")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "processes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomComponent" (
    "id" TEXT NOT NULL,
    "parentPartNumber" TEXT NOT NULL,
    "componentPartNumber" TEXT NOT NULL,
    "quantityPerAssy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "shift" INTEGER NOT NULL,
    "dueTime" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "line" TEXT NOT NULL,
    "process" TEXT,
    "qty" INTEGER NOT NULL,
    "sourceShift" INTEGER,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "targetShift" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "partNumber" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "line" TEXT,
    "process" TEXT,
    "sourceShift" INTEGER,
    "targetShift" INTEGER,
    "kanban" TEXT NOT NULL,
    "taken" INTEGER NOT NULL,
    "printedQty" INTEGER NOT NULL DEFAULT 0,
    "printedKanbans" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" "QueueStatus" NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "operatorId" TEXT,

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedBox" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "line" TEXT,
    "qty" INTEGER NOT NULL,
    "kanban" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAtEpoch" BIGINT,
    "date" TEXT,
    "operator" TEXT NOT NULL,
    "shift" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorUserId" TEXT,

    CONSTRAINT "CompletedBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionShiftRecord" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "process" TEXT,
    "shift" INTEGER NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "ng" INTEGER NOT NULL DEFAULT 0,
    "operator" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "updatedAtEpoch" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "operatorUserId" TEXT,

    CONSTRAINT "ProductionShiftRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NgShiftRecord" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "shift" INTEGER NOT NULL,
    "ng" INTEGER NOT NULL DEFAULT 0,
    "operator" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "updatedAtEpoch" BIGINT,
    "line" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NgShiftRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "boxes" INTEGER NOT NULL,
    "pcsPerBox" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "destination" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requester" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "store" INTEGER NOT NULL DEFAULT 0,
    "buffer" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "maxStore" INTEGER NOT NULL DEFAULT 0,
    "packaging" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT NOT NULL,
    "status" "StockStatus" NOT NULL DEFAULT 'safe',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BufferItem" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "kanban" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator" TEXT NOT NULL,
    "waitingMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BufferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "line" TEXT,
    "process" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BomComponent_parentPartNumber_componentPartNumber_key" ON "BomComponent"("parentPartNumber", "componentPartNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRequest_code_key" ON "ProductionRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionShiftRecord_date_partNumber_type_shift_line_proce_key" ON "ProductionShiftRecord"("date", "partNumber", "type", "shift", "line", "process");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_code_key" ON "MaterialRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_partNumber_key" ON "StockItem"("partNumber");

-- AddForeignKey
ALTER TABLE "UserWorkArea" ADD CONSTRAINT "UserWorkArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkArea" ADD CONSTRAINT "UserWorkArea_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequest" ADD CONSTRAINT "ProductionRequest_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedBox" ADD CONSTRAINT "CompletedBox_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedBox" ADD CONSTRAINT "CompletedBox_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionShiftRecord" ADD CONSTRAINT "ProductionShiftRecord_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionShiftRecord" ADD CONSTRAINT "ProductionShiftRecord_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NgShiftRecord" ADD CONSTRAINT "NgShiftRecord_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
