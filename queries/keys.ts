import type { AttachmentRecord } from './attachments/types';

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: () => [...vehicleKeys.all, 'list'] as const,
  byStatus: (status: 'active' | 'archived') => [...vehicleKeys.list(), status] as const,
  detail: (id: string) => [...vehicleKeys.all, 'detail', id] as const,
};

export const vehicleSummaryKeys = {
  byVehicle: (vehicleId: string) => ['vehicle-summary', vehicleId] as const,
};

export const expenseKeys = {
  all: ['expenses'] as const,
  byVehicle: (vehicleId: string) => [...expenseKeys.all, vehicleId] as const,
  infiniteByVehicle: (vehicleId: string) => [...expenseKeys.all, 'infinite', vehicleId] as const,
};

export const fillUpKeys = {
  all: ['fillups'] as const,
  byVehicle: (vehicleId: string) => [...fillUpKeys.all, vehicleId] as const,
  infiniteByVehicle: (vehicleId: string) => [...fillUpKeys.all, 'infinite', vehicleId] as const,
};

export const tireKeys = {
  sets: (vehicleId: string) => ['tireSets', vehicleId] as const,
  history: (vehicleId: string) => ['tireChangeHistory', vehicleId] as const,
};

export const adminKeys = {
  all: ['admin'] as const,
  me: () => [...adminKeys.all, 'me'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  vehicles: () => [...adminKeys.all, 'vehicles'] as const,
  vehicleAccess: (vehicleId: string) => [...adminKeys.all, 'vehicle-access', vehicleId] as const,
};

export const attachmentKeys = {
  byRecord: (vehicleId: string, record: AttachmentRecord) =>
    record.type === 'vehicle'
      ? (['attachments', vehicleId, 'vehicle'] as const)
      : (['attachments', vehicleId, record.type, record.id] as const),
};
