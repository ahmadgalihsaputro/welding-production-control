-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "model" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "KanbanPartConfig" ADD COLUMN     "printerId" TEXT;

-- CreateIndex
CREATE INDEX "KanbanPartConfig_printerId_idx" ON "KanbanPartConfig"("printerId");

-- AddForeignKey
ALTER TABLE "KanbanPartConfig" ADD CONSTRAINT "KanbanPartConfig_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
