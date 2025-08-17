export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: () => [...vehicleKeys.all, 'list'] as const,
  detail: (id: string) => [...vehicleKeys.all, 'detail', id] as const,
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
