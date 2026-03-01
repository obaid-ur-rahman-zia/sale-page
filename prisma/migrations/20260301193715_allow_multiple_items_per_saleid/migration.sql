-- DropIndex
DROP INDEX "Sale_saleId_key";

-- CreateIndex
CREATE INDEX "Sale_saleId_idx" ON "Sale"("saleId");
