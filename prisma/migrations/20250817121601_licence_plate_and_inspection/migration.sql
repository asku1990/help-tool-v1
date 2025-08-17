-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "inspectionDueDate" TIMESTAMP(3),
ADD COLUMN     "inspectionIntervalMonths" INTEGER,
ADD COLUMN     "licensePlate" VARCHAR(16);

-- CreateIndex
CREATE INDEX "Vehicle_userId_licensePlate_idx" ON "Vehicle"("userId", "licensePlate");
