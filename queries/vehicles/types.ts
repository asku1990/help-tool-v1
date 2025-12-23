export type VehicleDto = {
  id: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  licensePlate?: string | null;
  inspectionDueDate?: string | null;
  inspectionIntervalMonths?: number | null;
  initialOdometer?: number | null;
};
