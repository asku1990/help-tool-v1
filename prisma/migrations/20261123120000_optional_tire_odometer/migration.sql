-- Preserve existing readings without assuming they were entered manually.
ALTER TABLE "TireChangeLog"
  ALTER COLUMN "odometerKm" DROP NOT NULL,
  ADD COLUMN "odometerConfirmed" BOOLEAN NOT NULL DEFAULT false;
