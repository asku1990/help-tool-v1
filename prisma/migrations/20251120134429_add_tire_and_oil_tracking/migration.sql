-- CreateEnum
CREATE TYPE "TireType" AS ENUM ('SUMMER', 'WINTER', 'ALL_SEASON');

-- CreateEnum
CREATE TYPE "TireStatus" AS ENUM ('ACTIVE', 'STORED', 'RETIRED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "isOilChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liters" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "initialOdometer" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "TireSet" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TireType" NOT NULL,
    "status" "TireStatus" NOT NULL DEFAULT 'ACTIVE',
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
