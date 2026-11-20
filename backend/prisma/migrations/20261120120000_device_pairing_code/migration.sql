-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "pairingCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Device_pairingCode_key" ON "Device"("pairingCode");
