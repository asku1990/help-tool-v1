import { apiGet } from '@/lib/api/client';
import type { VehicleDto } from './types';

export type VehicleStatus = 'active' | 'archived';

export function listVehicles(status: VehicleStatus = 'active') {
  return apiGet<{ vehicles: VehicleDto[]; hasArchivedVehicles?: boolean }>(
    status === 'active' ? '/api/vehicles' : '/api/vehicles?status=archived'
  );
}
