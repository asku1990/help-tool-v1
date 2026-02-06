import { apiDelete, apiGet, apiPut } from '@/lib/api/client';

export type AdminUser = {
  id: string;
  email: string;
  username: string;
  userType: 'ADMIN' | 'REGULAR' | 'GUEST';
  createdAt: string;
};

export type AdminVehicle = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  userId: string;
  ownerEmail: string;
  createdAt: string;
  accessCount: number;
};

export type VehicleAccessItem = {
  id: string;
  userId: string;
  userEmail: string;
  username: string;
  role: 'VIEWER' | 'EDITOR' | 'OWNER';
  createdAt: string;
};

export type VehicleAccessResponse = {
  vehicle: { id: string; name: string };
  access: VehicleAccessItem[];
};

export function listAdminUsers() {
  return apiGet<{ users: AdminUser[] }>('/api/admin/users');
}

export function listAdminVehicles() {
  return apiGet<{ vehicles: AdminVehicle[] }>('/api/admin/vehicles');
}

export function getAdminVehicleAccess(vehicleId: string) {
  return apiGet<VehicleAccessResponse>(`/api/admin/vehicles/${vehicleId}/access`);
}

export function upsertAdminVehicleAccess(
  vehicleId: string,
  payload: { userId: string; role: VehicleAccessItem['role'] }
) {
  return apiPut<{ access: { id: string } }>(`/api/admin/vehicles/${vehicleId}/access`, payload);
}

export function revokeAdminVehicleAccess(vehicleId: string, userId: string) {
  return apiDelete<{ ok: boolean }>(`/api/admin/vehicles/${vehicleId}/access`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}
