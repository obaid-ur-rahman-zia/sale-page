-- CreateTable
CREATE TABLE "SaleBill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" TEXT NOT NULL,
    "totalDiscount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleBill_saleId_key" ON "SaleBill"("saleId");

-- CreateIndex
CREATE INDEX "SaleBill_createdAt_idx" ON "SaleBill"("createdAt");
