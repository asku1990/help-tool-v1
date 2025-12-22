'use client';

import { useState, useMemo } from 'react';
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
import type { TireType, TireStatus } from '@/queries/tires';
import {
  useLatestOdometer,
  useTireSets,
  useTireChangeHistory,
  useCreateTireSet,
  useUpdateTireSet,
  useDeleteTireSet,
  useLogTireChange,
  useUpdateTireChangeLog,
  useDeleteTireChangeLog,
} from '@/hooks';
import { calculateTireUsage, formatDuration } from '@/utils';

type TireManagerProps = {
  vehicleId: string;
};

export default function TireManager({ vehicleId }: TireManagerProps) {
  const { data, isLoading } = useTireSets(vehicleId);
  const { data: historyData } = useTireChangeHistory(vehicleId);

  const hasHistory = (historyData?.history.length ?? 0) > 0;

  const latestOdometer = useLatestOdometer(vehicleId);

  // Calculate usage stats for all tire sets
  const usageStats = useMemo(() => {
    const tireSets = data?.tireSets || [];
    const history = historyData?.history || [];
    return calculateTireUsage(tireSets, history, latestOdometer ?? undefined);
  }, [data?.tireSets, historyData?.history, latestOdometer]);

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

  // Edit change log state
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<{
    id: string;
    date: string;
    odometerKm: string;
    tireSetName: string;
  } | null>(null);

  // Collapsible swap history
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Mutations
  const createMutation = useCreateTireSet(vehicleId);
  const updateMutation = useUpdateTireSet(vehicleId);
  const deleteMutation = useDeleteTireSet(vehicleId);
  const logChangeMutation = useLogTireChange(vehicleId);
  const updateLogMutation = useUpdateTireChangeLog(vehicleId);
  const deleteLogMutation = useDeleteTireChangeLog(vehicleId);

  const handleCreate = async () => {
    await createMutation.mutateAsync({
      name: newName,
      type: newType,
      purchaseDate: newPurchaseDate || undefined,
    });
    setIsAddOpen(false);
    setNewName('');
    setNewType('SUMMER');
    setNewPurchaseDate('');
  };

  const handleSwap = async () => {
    await logChangeMutation.mutateAsync({
      tireSetId: selectedTireSetId,
      date: swapDate,
      odometerKm: parseInt(swapOdometer, 10),
    });
    setIsSwapOpen(false);
    setSwapOdometer('');
    setSelectedTireSetId('');
  };

  const activeTireSet = data?.tireSets.find(t => t.status === 'ACTIVE');
  const storedTireSets = data?.tireSets.filter(t => t.status === 'STORED') || [];
  const retiredTireSets = data?.tireSets.filter(t => t.status === 'RETIRED') || [];

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
                onClick={handleCreate}
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
                  {activeTireSet.type} • Installed{' '}
                  {activeTireSet.changeLogs?.[0]?.date
                    ? new Date(activeTireSet.changeLogs[0].date).toLocaleDateString()
                    : 'Unknown'}
                  {activeTireSet.changeLogs?.[0]?.odometerKm != null && (
                    <> @ {activeTireSet.changeLogs[0].odometerKm.toLocaleString()} km</>
                  )}
                </p>
                {(() => {
                  const stats = usageStats.get(activeTireSet.id);
                  // Calculate only current period km (from last mount to now)
                  const lastMountOdo = activeTireSet.changeLogs?.[0]?.odometerKm || 0;
                  const currentPeriodKm =
                    latestOdometer != null && latestOdometer > lastMountOdo
                      ? latestOdometer - lastMountOdo
                      : 0;
                  const storedKm = activeTireSet.totalKm;
                  const totalKm =
                    storedKm > 0
                      ? storedKm + currentPeriodKm
                      : hasHistory
                        ? (stats?.totalKm ?? 0)
                        : currentPeriodKm;
                  const totalDays = stats?.totalDays || 0;

                  if (totalKm === 0 && totalDays === 0) return null;
                  return (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Usage: {totalKm.toLocaleString()} km • {formatDuration(totalDays)}
                    </p>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs border rounded px-2 py-1"
                  value="ACTIVE"
                  onChange={e => {
                    const newStatus = e.target.value as TireStatus;
                    if (newStatus !== 'ACTIVE' && activeTireSet) {
                      updateMutation.mutate({ tireSetId: activeTireSet.id, status: newStatus });
                    }
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="STORED">Store</option>
                  <option value="RETIRED">Retire</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (storedTireSets.length === 0) {
                      alert('Add another tire set first to swap.');
                      return;
                    }
                    if (latestOdometer != null) {
                      setSwapOdometer(String(latestOdometer));
                    }
                    setIsSwapOpen(true);
                  }}
                >
                  Swap
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No active tire set.
            {data?.tireSets.length && data.tireSets.length > 0 ? (
              <Button
                variant="link"
                onClick={() => {
                  if (latestOdometer != null) {
                    setSwapOdometer(String(latestOdometer));
                  }
                  setIsSwapOpen(true);
                }}
              >
                Mount a set
              </Button>
            ) : null}
          </div>
        )}

        {/* Stored Sets */}
        {storedTireSets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">Stored</h4>
            {storedTireSets.map(set => {
              const stats = usageStats.get(set.id);
              return (
                <div key={set.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-medium">{set.name}</p>
                    <p className="text-xs text-gray-500">
                      {set.type}
                      {stats && stats.lastUnmountedDate && (
                        <> • Last used: {new Date(stats.lastUnmountedDate).toLocaleDateString()}</>
                      )}
                    </p>
                    {(() => {
                      const storedKm = set.totalKm;
                      const totalKm =
                        storedKm > 0 ? storedKm : hasHistory ? (stats?.totalKm ?? 0) : 0;
                      const totalDays = stats?.totalDays || 0;
                      if (totalKm === 0 && totalDays === 0) return null;
                      return (
                        <p className="text-xs text-gray-400">
                          Total: {totalKm.toLocaleString()} km • {formatDuration(totalDays)}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border rounded px-2 py-1"
                      value={set.status}
                      onChange={e => {
                        const newStatus = e.target.value as TireStatus;
                        if (newStatus === 'ACTIVE') {
                          // Use swap flow for mounting
                          setSelectedTireSetId(set.id);
                          if (latestOdometer != null) {
                            setSwapOdometer(String(latestOdometer));
                          }
                          setIsSwapOpen(true);
                        } else {
                          updateMutation.mutate({ tireSetId: set.id, status: newStatus });
                        }
                      }}
                    >
                      <option value="STORED">Stored</option>
                      <option value="ACTIVE">Active (mount)</option>
                      <option value="RETIRED">Retired</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Delete this tire set permanently?')) {
                          deleteMutation.mutate(set.id);
                        }
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Retired Sets */}
        {retiredTireSets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400">Retired</h4>
            {retiredTireSets.map(set => {
              const stats = usageStats.get(set.id);
              return (
                <div
                  key={set.id}
                  className="flex justify-between items-center p-3 border rounded border-gray-200 bg-gray-50 opacity-60"
                >
                  <div>
                    <p className="font-medium text-gray-500">{set.name}</p>
                    <p className="text-xs text-gray-400">
                      {set.type}
                      {stats && stats.lastUnmountedDate && (
                        <> • Last used: {new Date(stats.lastUnmountedDate).toLocaleDateString()}</>
                      )}
                    </p>
                    {(() => {
                      const storedKm = set.totalKm;
                      const totalKm =
                        storedKm > 0 ? storedKm : hasHistory ? (stats?.totalKm ?? 0) : 0;
                      const totalDays = stats?.totalDays || 0;
                      if (totalKm === 0 && totalDays === 0) return null;
                      return (
                        <p className="text-xs text-gray-400">
                          Total: {totalKm.toLocaleString()} km • {formatDuration(totalDays)}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border rounded px-2 py-1"
                      value={set.status}
                      onChange={e => {
                        const newStatus = e.target.value as TireStatus;
                        if (newStatus === 'ACTIVE') {
                          setSelectedTireSetId(set.id);
                          if (latestOdometer != null) {
                            setSwapOdometer(String(latestOdometer));
                          }
                          setIsSwapOpen(true);
                        } else {
                          updateMutation.mutate({ tireSetId: set.id, status: newStatus });
                        }
                      }}
                    >
                      <option value="RETIRED">Retired</option>
                      <option value="STORED">Stored</option>
                      <option value="ACTIVE">Active (mount)</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Delete this tire set permanently?')) {
                          deleteMutation.mutate(set.id);
                        }
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Swap History */}
        {hasHistory && (
          <div className="mt-4 pt-4 border-t">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 w-full text-left"
              onClick={() => setHistoryExpanded(!historyExpanded)}
            >
              <span
                className="transition-transform duration-200"
                style={{ transform: historyExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ▶
              </span>
              Swap History ({historyData?.history.length})
            </button>
            {historyExpanded && (
              <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
                {historyData?.history.map(log => {
                  const tireSet = data?.tireSets.find(t => t.id === log.tireSetId);
                  return (
                    <div
                      key={log.id}
                      className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                    >
                      <div>
                        <span className="font-medium">{tireSet?.name || 'Unknown'}</span>
                        <span className="text-gray-500 ml-2">
                          {new Date(log.date).toLocaleDateString()} @{' '}
                          {log.odometerKm.toLocaleString()} km
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => {
                            setEditingLog({
                              id: log.id,
                              date: new Date(log.date).toISOString().slice(0, 10),
                              odometerKm: String(log.odometerKm),
                              tireSetName: tireSet?.name || 'Unknown',
                            });
                            setIsEditLogOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={async () => {
                            if (confirm('Delete this swap entry?')) {
                              await deleteLogMutation.mutateAsync(log.id);
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Edit Log Dialog */}
        <Dialog open={isEditLogOpen} onOpenChange={setIsEditLogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Swap: {editingLog?.tireSetName}</DialogTitle>
            </DialogHeader>
            {editingLog && (
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Date</span>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={editingLog.date}
                    onChange={e => setEditingLog({ ...editingLog, date: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Odometer (km)</span>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    value={editingLog.odometerKm}
                    onChange={e => setEditingLog({ ...editingLog, odometerKm: e.target.value })}
                  />
                </label>
                <Button
                  className="w-full"
                  disabled={
                    !editingLog.date || !editingLog.odometerKm || updateLogMutation.isPending
                  }
                  onClick={async () => {
                    await updateLogMutation.mutateAsync({
                      logId: editingLog.id,
                      date: editingLog.date,
                      odometerKm: parseInt(editingLog.odometerKm, 10),
                    });
                    setIsEditLogOpen(false);
                    setEditingLog(null);
                  }}
                >
                  {updateLogMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
                  {storedTireSets.map(t => (
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
                  placeholder={
                    latestOdometer != null
                      ? `Last: ${latestOdometer.toLocaleString()} km`
                      : 'Current reading'
                  }
                />
              </label>
              <Button
                className="w-full"
                disabled={!selectedTireSetId || !swapOdometer || logChangeMutation.isPending}
                onClick={handleSwap}
              >
                {logChangeMutation.isPending ? 'Swapping...' : 'Confirm Swap'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
