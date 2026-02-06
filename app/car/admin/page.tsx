'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Card, CardContent } from '@/components/ui';
import PageHeader from '@/components/layout/PageHeader';
import { apiGet, apiPut } from '@/lib/api/client';

type AdminUser = {
  id: string;
  email: string;
  username: string;
  userType: 'ADMIN' | 'REGULAR' | 'GUEST';
  createdAt: string;
};

type AdminVehicle = {
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

type VehicleAccessItem = {
  id: string;
  userId: string;
  userEmail: string;
  username: string;
  role: 'VIEWER' | 'EDITOR' | 'OWNER';
  createdAt: string;
};

type VehicleAccessResponse = {
  vehicle: { id: string; name: string };
  access: VehicleAccessItem[];
};

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessData, setAccessData] = useState<VehicleAccessResponse | null>(null);
  const [role, setRole] = useState<'VIEWER' | 'EDITOR' | 'OWNER'>('VIEWER');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let canceled = false;
    async function loadInitialData() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [usersResponse, vehiclesResponse] = await Promise.all([
          apiGet<{ users: AdminUser[] }>('/api/admin/users'),
          apiGet<{ vehicles: AdminVehicle[] }>('/api/admin/vehicles'),
        ]);
        if (canceled) return;

        setUsers(usersResponse.users);
        setVehicles(vehiclesResponse.vehicles);
        setSelectedVehicleId(vehiclesResponse.vehicles[0]?.id ?? '');
        setSelectedUserId(usersResponse.users[0]?.id ?? '');
      } catch (error) {
        if (canceled) return;
        if (error instanceof Error && error.message === 'Forbidden') {
          router.replace('/car');
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load admin data');
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void loadInitialData();
    return () => {
      canceled = true;
    };
  }, [status, router]);

  useEffect(() => {
    if (!selectedVehicleId) {
      setAccessData(null);
      return;
    }

    let canceled = false;
    async function loadVehicleAccess() {
      setErrorMessage(null);
      try {
        const response = await apiGet<VehicleAccessResponse>(
          `/api/admin/vehicles/${selectedVehicleId}/access`
        );
        if (!canceled) setAccessData(response);
      } catch (error) {
        if (!canceled) {
          setAccessData(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load vehicle access');
        }
      }
    }

    void loadVehicleAccess();
    return () => {
      canceled = true;
    };
  }, [selectedVehicleId]);

  const selectedVehicleName = useMemo(
    () => vehicles.find(vehicle => vehicle.id === selectedVehicleId)?.name ?? '',
    [selectedVehicleId, vehicles]
  );

  async function refreshAccess() {
    if (!selectedVehicleId) return;
    const response = await apiGet<VehicleAccessResponse>(
      `/api/admin/vehicles/${selectedVehicleId}/access`
    );
    setAccessData(response);
  }

  async function onGrantOrUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedVehicleId || !selectedUserId) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await apiPut<{ access: { id: string } }>(`/api/admin/vehicles/${selectedVehicleId}/access`, {
        userId: selectedUserId,
        role,
      });
      await refreshAccess();
      const selectedUser = users.find(user => user.id === selectedUserId);
      setSuccessMessage(`Access updated for ${selectedUser?.email ?? selectedUserId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update access');
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevoke(userId: string) {
    if (!selectedVehicleId) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/admin/vehicles/${selectedVehicleId}/access`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok || body.error) {
        throw new Error(body.error?.message || `Request failed: ${response.status}`);
      }
      await refreshAccess();
      setSuccessMessage('Access revoked');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to revoke access');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <PageHeader
        title="Admin"
        right={
          <Link href="/car" className="text-sm text-blue-600 hover:underline">
            Back to vehicles
          </Link>
        }
      />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {errorMessage ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {successMessage}
          </div>
        ) : null}

        <Card>
          <CardContent className="!p-4 sm:!p-6">
            <h2 className="text-lg font-semibold">Users</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Username</th>
                    <th className="py-2 pr-4">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{user.email}</td>
                      <td className="py-2 pr-4">{user.username}</td>
                      <td className="py-2 pr-4">{user.userType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="!p-4 sm:!p-6">
            <h2 className="text-lg font-semibold">Vehicles</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Vehicle</th>
                    <th className="py-2 pr-4">Owner Email</th>
                    <th className="py-2 pr-4">Access Count</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(vehicle => (
                    <tr key={vehicle.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {[vehicle.name, vehicle.make, vehicle.model, vehicle.year ?? '']
                          .filter(Boolean)
                          .join(' ')}
                      </td>
                      <td className="py-2 pr-4">{vehicle.ownerEmail}</td>
                      <td className="py-2 pr-4">{vehicle.accessCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="!p-4 sm:!p-6 space-y-4">
            <h2 className="text-lg font-semibold">Access Manager</h2>

            <label className="flex flex-col gap-1">
              <span className="text-sm">Vehicle</span>
              <select
                className="border rounded-md px-3 py-2"
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
              >
                <option value="" disabled>
                  Select a vehicle
                </option>
                {vehicles.map(vehicle => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </label>

            <form className="grid grid-cols-1 sm:grid-cols-3 gap-3" onSubmit={onGrantOrUpdate}>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-sm">User</span>
                <select
                  className="border rounded-md px-3 py-2"
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select a user
                  </option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email} ({user.username})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm">Role</span>
                <select
                  className="border rounded-md px-3 py-2"
                  value={role}
                  onChange={e => setRole(e.target.value as 'VIEWER' | 'EDITOR' | 'OWNER')}
                >
                  <option value="VIEWER">VIEWER</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </label>
              <div className="sm:col-span-3">
                <Button
                  type="submit"
                  disabled={!selectedVehicleId || !selectedUserId || submitting}
                >
                  {submitting ? 'Saving…' : 'Grant / Update Access'}
                </Button>
              </div>
            </form>

            <div>
              <h3 className="font-medium">
                Current access {selectedVehicleName ? `for ${selectedVehicleName}` : ''}
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Username</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(accessData?.access || []).map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{item.userEmail}</td>
                        <td className="py-2 pr-4">{item.username}</td>
                        <td className="py-2 pr-4">{item.role}</td>
                        <td className="py-2 pr-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onRevoke(item.userId)}
                            disabled={submitting}
                          >
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {accessData && accessData.access.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-2 text-gray-500">
                          No access rows found for this vehicle.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
