BEGIN;

ALTER TABLE "Attachment"
    DROP CONSTRAINT "Attachment_vehicleId_fkey",
    DROP CONSTRAINT "Attachment_expenseId_fkey",
    DROP CONSTRAINT "Attachment_fuelFillUpId_fkey";

ALTER TABLE "Attachment"
    ADD CONSTRAINT "Attachment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Attachment_fuelFillUpId_fkey" FOREIGN KEY ("fuelFillUpId") REFERENCES "FuelFillUp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
