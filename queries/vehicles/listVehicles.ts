import { apiGet } from '@/lib/api/client';
import type { VehicleDto } from './types';

export function listVehicles() {
  return apiGet<{ vehicles: VehicleDto[] }>('/api/vehicles');
}
