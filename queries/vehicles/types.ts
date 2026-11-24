export type VehicleDto = {
  id: string;
  name: string;
  archivedAtUtc?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  licensePlate?: string | null;
  inspectionDueDate?: string | null;
  inspectionIntervalMonths?: number | null;
  initialOdometer?: number | null;
};
