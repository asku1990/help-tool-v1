'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTireSets,
  createTireSet,
  deleteTireSet,
  logTireChange,
  type TireType,
} from '@/queries/tires';

type TireManagerProps = {
  vehicleId: string;
};

export default function TireManager({ vehicleId }: TireManagerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tireSets', vehicleId],
    queryFn: () => listTireSets(vehicleId),
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [selectedTireSetId, setSelectedTireSetId] = useState<string>('');

  // Add form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TireType>('SUMMER');
  const [newPurchaseDate, setNewPurchaseDate] = useState('');

  // Swap form state
  const [swapOdometer, setSwapOdometer] = useState('');
  const [swapDate, setSwapDate] = useState(new Date().toISOString().slice(0, 10));

  const createMutation = useMutation({
    mutationFn: () =>
      createTireSet(vehicleId, {
        name: newName,
        type: newType,
        purchaseDate: newPurchaseDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
      setIsAddOpen(false);
      setNewName('');
      setNewType('SUMMER');
      setNewPurchaseDate('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTireSet(vehicleId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
    },
  });

  const swapMutation = useMutation({
    mutationFn: () =>
      logTireChange(vehicleId, {
        tireSetId: selectedTireSetId,
        date: swapDate,
        odometerKm: parseInt(swapOdometer, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tireSets', vehicleId] });
      // Also invalidate vehicle/history if needed?
      setIsSwapOpen(false);
      setSwapOdometer('');
      setSelectedTireSetId('');
    },
  });

  const activeTireSet = data?.tireSets.find(t => t.status === 'ACTIVE');
  const otherTireSets = data?.tireSets.filter(t => t.status !== 'ACTIVE') || [];

  if (isLoading) return <div>Loading tires...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tires</CardTitle>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Add Set
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tire Set</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Nokian Hakkapeliitta"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Type</span>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={newType}
                  onChange={e => setNewType(e.target.value as TireType)}
                >
                  <option value="SUMMER">Summer</option>
                  <option value="WINTER">Winter</option>
                  <option value="ALL_SEASON">All Season</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Purchase Date</span>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={newPurchaseDate}
                  onChange={e => setNewPurchaseDate(e.target.value)}
                />
              </label>
              <Button
                className="w-full"
                disabled={!newName || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Tire Set'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Set */}
        {activeTireSet ? (
          <div className="p-4 border rounded bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-300">
                  Current: {activeTireSet.name}
                </h3>
                <p className="text-sm text-green-700 dark:text-green-400">
                  {activeTireSet.type} • Installed since{' '}
                  {activeTireSet.changeLogs?.[0]?.date
                    ? new Date(activeTireSet.changeLogs[0].date).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // To swap, we need to select a DIFFERENT set.
                  // If there are no other sets, prompt to add one?
                  if (otherTireSets.length === 0) {
                    alert('Add another tire set first to swap.');
                    return;
                  }
                  setIsSwapOpen(true);
                }}
              >
                Swap
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No active tire set.
            {data?.tireSets.length && data.tireSets.length > 0 ? (
              <Button variant="link" onClick={() => setIsSwapOpen(true)}>
                Mount a set
              </Button>
            ) : null}
          </div>
        )}

        {/* Other Sets */}
        {otherTireSets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">Stored Sets</h4>
            {otherTireSets.map(set => (
              <div key={set.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-medium">{set.name}</p>
                  <p className="text-xs text-gray-500">{set.type}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (confirm('Delete this tire set?')) {
                        deleteMutation.mutate(set.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Swap Dialog */}
        <Dialog open={isSwapOpen} onOpenChange={setIsSwapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Swap Tires</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Select Set to Mount</span>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={selectedTireSetId}
                  onChange={e => setSelectedTireSetId(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {data?.tireSets
                    .filter(t => t.status !== 'ACTIVE')
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.type})
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Date</span>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={swapDate}
                  onChange={e => setSwapDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Odometer (km)</span>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={swapOdometer}
                  onChange={e => setSwapOdometer(e.target.value)}
                  placeholder="Current reading"
                />
              </label>
              <Button
                className="w-full"
                disabled={!selectedTireSetId || !swapOdometer || swapMutation.isPending}
                onClick={() => swapMutation.mutate()}
              >
                {swapMutation.isPending ? 'Swapping...' : 'Confirm Swap'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
