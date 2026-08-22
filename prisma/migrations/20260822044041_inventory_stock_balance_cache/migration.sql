-- CreateTable
CREATE TABLE "inventory_stock_balances" (
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_stock_balances_pkey" PRIMARY KEY ("itemId","locationId")
);

-- AddForeignKey
ALTER TABLE "inventory_stock_balances" ADD CONSTRAINT "inventory_stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_balances" ADD CONSTRAINT "inventory_stock_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
