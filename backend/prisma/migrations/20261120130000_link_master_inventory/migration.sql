-- Hubungkan master part, inventory, BOM, jadwal, dan transaksi dengan FK nyata.
-- Data lama sudah diverifikasi bersih sebelum constraint ditambahkan.

ALTER TABLE "ProductionPart" ADD CONSTRAINT "ProductionPart_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "StockItem"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_parentPartNumber_fkey" FOREIGN KEY ("parentPartNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_componentPartNumber_fkey" FOREIGN KEY ("componentPartNumber") REFERENCES "StockItem"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Routing" ADD CONSTRAINT "Routing_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "ProductionPart"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "StockItem"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BufferItem" ADD CONSTRAINT "BufferItem_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "StockItem"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partNumber_fkey" FOREIGN KEY ("partNumber") REFERENCES "StockItem"("partNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
