import { apiPatch } from '@/lib/api/client';

export function updateVehicle(
  vehicleId: string,
  payload: Partial<{
    name: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string | null;
    inspectionDueDate: string | null;
    inspectionIntervalMonths: number | null;
    initialOdometer: number | null;
  }>
) {
  return apiPatch<{ id: string }>(`/api/vehicles/${vehicleId}`, payload);
}
