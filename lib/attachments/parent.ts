import type { Prisma } from '@/generated/prisma';

export type AttachmentParent = { type: 'vehicle' } | { type: 'expense' | 'fillup'; id: string };

export function attachmentParentKey(vehicleId: string, parent: AttachmentParent) {
  switch (parent.type) {
    case 'vehicle':
      return { vehicleId };
    case 'expense':
      return { expenseId: parent.id };
    case 'fillup':
      return { fuelFillUpId: parent.id };
  }
}

export function attachmentParentScope(
  vehicleId: string,
  parent: AttachmentParent
): Prisma.AttachmentWhereInput {
  const key = attachmentParentKey(vehicleId, parent);
  switch (parent.type) {
    case 'vehicle':
      return key;
    case 'expense':
      return { ...key, expense: { vehicleId } };
    case 'fillup':
      return { ...key, fuelFillUp: { vehicleId } };
  }
}
