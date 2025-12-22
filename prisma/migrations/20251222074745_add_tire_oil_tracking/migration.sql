-- CreateEnum
CREATE TYPE "TireType" AS ENUM ('SUMMER', 'WINTER', 'ALL_SEASON');

-- CreateEnum
CREATE TYPE "TireStatus" AS ENUM ('ACTIVE', 'STORED', 'RETIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseCategory" ADD VALUE 'OIL_CHANGE';
ALTER TYPE "ExpenseCategory" ADD VALUE 'OIL_TOP_UP';
ALTER TYPE "ExpenseCategory" ADD VALUE 'INSPECTION';
ALTER TYPE "ExpenseCategory" ADD VALUE 'TIRES';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "liters" DECIMAL(10,2),
ADD COLUMN     "oilConsumption" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "initialOdometer" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "TireSet" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TireType" NOT NULL,
    "status" "TireStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalKm" INTEGER NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TireChangeLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tireSetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "odometerKm" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TireSet_vehicleId_idx" ON "TireSet"("vehicleId");

-- CreateIndex
CREATE INDEX "TireChangeLog_vehicleId_date_idx" ON "TireChangeLog"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "TireChangeLog_tireSetId_idx" ON "TireChangeLog"("tireSetId");

-- AddForeignKey
ALTER TABLE "TireSet" ADD CONSTRAINT "TireSet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireChangeLog" ADD CONSTRAINT "TireChangeLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireChangeLog" ADD CONSTRAINT "TireChangeLog_tireSetId_fkey" FOREIGN KEY ("tireSetId") REFERENCES "TireSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
