ALTER TABLE "ProductionRequest"
ADD COLUMN "barcodePayload" TEXT;

ALTER TABLE "QueueItem"
ADD COLUMN "barcodePayload" TEXT;
