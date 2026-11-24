import { Prisma } from '@/generated/prisma';

export function isAttachmentParentConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003' &&
    typeof error.meta?.field_name === 'string' &&
    /^Attachment_(vehicleId|expenseId|fuelFillUpId)_fkey(?: \(index\))?$/.test(
      error.meta.field_name
    )
  );
}
