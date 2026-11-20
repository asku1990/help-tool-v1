BEGIN;

-- Replace the old two-parent check atomically. Existing rows keep their current parent.
ALTER TABLE "Attachment"
    ADD COLUMN "vehicleId" TEXT,
    DROP CONSTRAINT "Attachment_exactly_one_parent",
    ADD CONSTRAINT "Attachment_exactly_one_parent"
        CHECK (num_nonnulls("vehicleId", "expenseId", "fuelFillUpId") = 1),
    ADD CONSTRAINT "Attachment_vehicleId_fkey"
        FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Attachment_vehicleId_idx" ON "Attachment"("vehicleId");

COMMIT;
