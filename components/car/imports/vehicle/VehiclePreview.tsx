'use client';

import type { ParsedVehicle } from '@/utils/csv';

export type RestoreMode = 'pending' | 'create' | 'update';

type Props = {
  vehicle: ParsedVehicle;
  matchingVehicle: { id: string; name: string } | null | undefined;
  existingVehicles: Array<{ id: string; name: string }>;
  restoreMode: RestoreMode;
  selectedVehicleId: string;
  onModeChange: (_mode: RestoreMode) => void;
  onVehicleSelect: (_id: string) => void;
};

export default function VehiclePreview({
  vehicle,
  matchingVehicle,
  existingVehicles,
  restoreMode,
  selectedVehicleId,
  onModeChange,
  onVehicleSelect,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Vehicle from Backup</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Name:</span> {vehicle.name}
          </div>
          {vehicle.make && (
            <div>
              <span className="text-gray-500">Make:</span> {vehicle.make}
            </div>
          )}
          {vehicle.model && (
            <div>
              <span className="text-gray-500">Model:</span> {vehicle.model}
            </div>
          )}
          {vehicle.year && (
            <div>
              <span className="text-gray-500">Year:</span> {vehicle.year}
            </div>
          )}
          {vehicle.licensePlate && (
            <div>
              <span className="text-gray-500">License:</span> {vehicle.licensePlate}
            </div>
          )}
          {vehicle.initialOdometer !== undefined && (
            <div>
              <span className="text-gray-500">Initial Odometer:</span> {vehicle.initialOdometer} km
            </div>
          )}
        </div>
      </div>

      {matchingVehicle && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
          A vehicle named &quot;{matchingVehicle.name}&quot; already exists.
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-medium">Choose restore action:</h4>

        <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="restoreMode"
            value="create"
            checked={restoreMode === 'create'}
            onChange={() => onModeChange('create')}
            className="mt-1"
          />
          <div>
            <div className="font-medium">Create new vehicle</div>
            <div className="text-sm text-gray-500">
              Create a new vehicle named &quot;{vehicle.name}&quot; and import all data
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="restoreMode"
            value="update"
            checked={restoreMode === 'update'}
            onChange={() => {
              onModeChange('update');
              if (matchingVehicle) {
                onVehicleSelect(matchingVehicle.id);
              } else if (existingVehicles.length > 0) {
                onVehicleSelect(existingVehicles[0].id);
              }
            }}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-medium">Update existing vehicle</div>
            <div className="text-sm text-gray-500 mb-2">
              Import data into an existing vehicle (optionally clear existing data first)
            </div>
            {restoreMode === 'update' && existingVehicles.length > 0 && (
              <select
                className="border rounded px-2 py-1 text-sm w-full"
                value={selectedVehicleId}
                onChange={e => onVehicleSelect(e.target.value)}
              >
                {existingVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
            {restoreMode === 'update' && existingVehicles.length === 0 && (
              <div className="text-sm text-red-600">No existing vehicles found</div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}
