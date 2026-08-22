-- CreateEnum
CREATE TYPE "CafeteriaStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CafeteriaItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CafeteriaMealType" AS ENUM ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER', 'A_LA_CARTE');

-- CreateTable
CREATE TABLE "cafeteria_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CafeteriaStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cafeteria_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafeteria_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "dietaryTags" TEXT[],
    "priceMinorUnits" INTEGER,
    "status" "CafeteriaItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cafeteria_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafeteria_menus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "CafeteriaMealType" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cafeteria_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafeteria_menu_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "cafeteriaItemId" TEXT NOT NULL,
    "servingOrder" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cafeteria_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafeteria_meal_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "cafeteriaItemId" TEXT,
    "studentId" TEXT,
    "staffId" TEXT,
    "servedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "servedByUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cafeteria_meal_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cafeteria_locations_schoolId_code_key" ON "cafeteria_locations"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cafeteria_items_schoolId_code_key" ON "cafeteria_items"("schoolId", "code");

-- CreateIndex
CREATE INDEX "cafeteria_menus_schoolId_branchId_date_idx" ON "cafeteria_menus"("schoolId", "branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cafeteria_menus_locationId_date_mealType_key" ON "cafeteria_menus"("locationId", "date", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "cafeteria_menu_items_menuId_cafeteriaItemId_key" ON "cafeteria_menu_items"("menuId", "cafeteriaItemId");

-- CreateIndex
CREATE INDEX "cafeteria_meal_records_schoolId_branchId_servedAt_idx" ON "cafeteria_meal_records"("schoolId", "branchId", "servedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cafeteria_meal_records_menuId_studentId_key" ON "cafeteria_meal_records"("menuId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "cafeteria_meal_records_menuId_staffId_key" ON "cafeteria_meal_records"("menuId", "staffId");

-- AddForeignKey
ALTER TABLE "cafeteria_menus" ADD CONSTRAINT "cafeteria_menus_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "cafeteria_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafeteria_menu_items" ADD CONSTRAINT "cafeteria_menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "cafeteria_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafeteria_menu_items" ADD CONSTRAINT "cafeteria_menu_items_cafeteriaItemId_fkey" FOREIGN KEY ("cafeteriaItemId") REFERENCES "cafeteria_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafeteria_meal_records" ADD CONSTRAINT "cafeteria_meal_records_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "cafeteria_menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafeteria_meal_records" ADD CONSTRAINT "cafeteria_meal_records_cafeteriaItemId_fkey" FOREIGN KEY ("cafeteriaItemId") REFERENCES "cafeteria_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafeteria_meal_records" ADD CONSTRAINT "cafeteria_meal_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafeteria_meal_records" ADD CONSTRAINT "cafeteria_meal_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
