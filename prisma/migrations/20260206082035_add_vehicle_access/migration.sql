-- CreateEnum
CREATE TYPE "VehicleRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "VehicleAccess" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "VehicleRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleAccess_userId_idx" ON "VehicleAccess"("userId");

-- CreateIndex
CREATE INDEX "VehicleAccess_vehicleId_idx" ON "VehicleAccess"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleAccess_vehicleId_userId_key" ON "VehicleAccess"("vehicleId", "userId");

-- AddForeignKey
ALTER TABLE "VehicleAccess" ADD CONSTRAINT "VehicleAccess_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAccess" ADD CONSTRAINT "VehicleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill owner access for existing vehicles
INSERT INTO "VehicleAccess" ("id", "vehicleId", "userId", "role", "createdAt")
SELECT CONCAT('backfill-', v."id", '-', v."userId"), v."id", v."userId", 'OWNER'::"VehicleRole", NOW()
FROM "Vehicle" v
WHERE v."userId" IS NOT NULL
ON CONFLICT ("vehicleId", "userId") DO NOTHING;
