'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, Card, CardContent, Toaster } from '@/components/ui';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';
import { getUiErrorMessage } from '@/lib/api/client-errors';
import {
  useAdminUsers,
  useAdminVehicleAccess,
  useAdminVehicles,
  useRevokeAdminVehicleAccess,
  useUpsertAdminVehicleAccess,
} from '@/hooks';

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<'VIEWER' | 'EDITOR' | 'OWNER'>('VIEWER');
  const lastQueryErrorSignatureRef = useRef<string | null>(null);

  const queryEnabled = status === 'authenticated';
  const usersQuery = useAdminUsers(queryEnabled);
  const vehiclesQuery = useAdminVehicles(queryEnabled);
  const accessQuery = useAdminVehicleAccess(selectedVehicleId, queryEnabled && !!selectedVehicleId);
  const upsertAccessMutation = useUpsertAdminVehicleAccess();
  const revokeAccessMutation = useRevokeAdminVehicleAccess();

  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data?.users]);
  const vehicles = useMemo(
    () => vehiclesQuery.data?.vehicles ?? [],
    [vehiclesQuery.data?.vehicles]
  );
  const accessData = accessQuery.data;
  const submitting = upsertAccessMutation.isPending || revokeAccessMutation.isPending;

  const queryError = usersQuery.error ?? vehiclesQuery.error ?? accessQuery.error;
  const queryErrorMessage = queryError
    ? getUiErrorMessage(queryError, 'Failed to load admin data')
    : null;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (!queryErrorMessage) {
      lastQueryErrorSignatureRef.current = null;
      return;
    }
    const signature =
      queryError instanceof Error
        ? `${queryError.name}:${queryError.message}`
        : `unknown:${queryErrorMessage}`;
    if (lastQueryErrorSignatureRef.current === signature) return;
    lastQueryErrorSignatureRef.current = signature;
    toast.error(queryErrorMessage);
  }, [queryError, queryErrorMessage]);

  useEffect(() => {
    if (queryError instanceof Error && queryError.message === 'Forbidden') {
      router.replace('/car');
    }
  }, [queryError, router]);

  useEffect(() => {
    if (selectedVehicleId || vehicles.length === 0) {
      return;
    }
    setSelectedVehicleId(vehicles[0].id);
  }, [selectedVehicleId, vehicles]);

  useEffect(() => {
    if (selectedUserId || users.length === 0) {
      return;
    }
    setSelectedUserId(users[0].id);
  }, [selectedUserId, users]);

  const selectedVehicleName = useMemo(
    () => vehicles.find(vehicle => vehicle.id === selectedVehicleId)?.name ?? '',
    [selectedVehicleId, vehicles]
  );

  async function onGrantOrUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedVehicleId || !selectedUserId) return;

    try {
      await upsertAccessMutation.mutateAsync({
        vehicleId: selectedVehicleId,
        userId: selectedUserId,
        role,
      });
      const selectedUser = users.find(user => user.id === selectedUserId);
      toast.success(`Access updated for ${selectedUser?.email ?? selectedUserId}`);
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Failed to update access'));
    }
  }

  async function onRevoke(userId: string) {
    if (!selectedVehicleId) return;

    try {
      await revokeAccessMutation.mutateAsync({
        vehicleId: selectedVehicleId,
        userId,
      });
      toast.success('Access revoked');
    } catch (error) {
      toast.error(getUiErrorMessage(error, 'Failed to revoke access'));
    }
  }

  if (status === 'loading' || usersQuery.isLoading || vehiclesQuery.isLoading) {
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
      <Toaster />
    </div>
  );
}
