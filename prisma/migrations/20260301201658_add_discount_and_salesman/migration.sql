-- CreateTable
CREATE TABLE "Salesman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "categoryId" INTEGER NOT NULL,
    "salesmanId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("amount", "categoryId", "createdAt", "id", "saleId") SELECT "amount", "categoryId", "createdAt", "id", "saleId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_saleId_idx" ON "Sale"("saleId");
CREATE INDEX "Sale_salesmanId_idx" ON "Sale"("salesmanId");
CREATE INDEX "Sale_categoryId_createdAt_idx" ON "Sale"("categoryId", "createdAt");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Salesman_name_key" ON "Salesman"("name");
