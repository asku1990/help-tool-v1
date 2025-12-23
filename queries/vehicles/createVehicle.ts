import { apiPost } from '@/lib/api/client';

export function createVehicle(payload: {
  name: string;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  inspectionDueDate?: string;
  inspectionIntervalMonths?: number;
  initialOdometer?: number;
}) {
  return apiPost<{ id: string }>('/api/vehicles', payload);
}
