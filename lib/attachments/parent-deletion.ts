import { Prisma } from '@/generated/prisma';
import { conflict } from '@/lib/api/response';

export function attachmentParentDeletionConflict(
  error: unknown,
  message: string
): Response | undefined {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003' &&
    typeof error.meta?.field_name === 'string' &&
    /^Attachment_(vehicleId|expenseId|fuelFillUpId)_fkey(?: \(index\))?$/.test(
      error.meta.field_name
    )
  ) {
    return conflict('ATTACHMENTS_EXIST', message);
  }
}
