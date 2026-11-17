-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT,
    "fuelFillUpId" TEXT,
    "filename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAtUtc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Attachment_exactly_one_parent"
        CHECK (("expenseId" IS NOT NULL) <> ("fuelFillUpId" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_objectKey_key" ON "Attachment"("objectKey");

-- CreateIndex
CREATE INDEX "Attachment_expenseId_idx" ON "Attachment"("expenseId");

-- CreateIndex
CREATE INDEX "Attachment_fuelFillUpId_idx" ON "Attachment"("fuelFillUpId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fuelFillUpId_fkey" FOREIGN KEY ("fuelFillUpId") REFERENCES "FuelFillUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
