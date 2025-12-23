import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTireSet, logTireChange, type TireType, type TireStatus } from '@/queries/tires';

type ImportTireSetRow = {
  name: string;
  type: TireType;
  status?: TireStatus;
  purchaseDate?: string;
  notes?: string;
};

type ImportChangeLogRow = {
  tireSetId: string;
  date: string;
  odometerKm: number;
  notes?: string;
};

async function importTires(
  vehicleId: string,
  data: {
    tireSets: ImportTireSetRow[];
    changeLogs: ImportChangeLogRow[];
    /** Map from original export ID to tire set name (for linking change logs) */
    tireSetIdMap?: Map<string, string>;
  }
) {
  const { tireSets, changeLogs } = data;
  const exportIdToName = data.tireSetIdMap ?? new Map<string, string>();

  // Map from tire set name to new ID (filled after creation)
  const nameToNewId = new Map<string, string>();

  // Sort tire sets: STORED/RETIRED first, ACTIVE last
  // This ensures the ACTIVE tire is created last and properly sets others to STORED
  const sortedTireSets = [...tireSets].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return 1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return -1;
    return 0;
  });

  // Create tire sets SEQUENTIALLY to avoid race conditions
  let failedTireSets = 0;
  for (const ts of sortedTireSets) {
    try {
      const result = await createTireSet(vehicleId, {
        name: ts.name,
        type: ts.type,
        status: ts.status,
        purchaseDate: ts.purchaseDate,
        notes: ts.notes,
      });
      nameToNewId.set(ts.name, result.id);
    } catch {
      failedTireSets++;
    }
  }

  // Build complete exportId -> newId map by chaining exportId -> name -> newId
  const exportIdToNewId = new Map<string, string>();
  for (const [exportId, name] of exportIdToName.entries()) {
    const newId = nameToNewId.get(name);
    if (newId) {
      exportIdToNewId.set(exportId, newId);
    }
  }

  // Sort change logs by date (oldest first) so the most recent mount ends up ACTIVE
  const sortedChangeLogs = [...changeLogs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Create change logs SEQUENTIALLY to avoid race conditions
  let failedChangeLogs = 0;
  for (const cl of sortedChangeLogs) {
    try {
      const tireSetId =
        exportIdToNewId.get(cl.tireSetId) ?? nameToNewId.get(cl.tireSetId) ?? cl.tireSetId;
      await logTireChange(vehicleId, {
        tireSetId,
        date: cl.date,
        odometerKm: cl.odometerKm,
        notes: cl.notes,
      });
    } catch {
      failedChangeLogs++;
    }
  }

  if (failedTireSets > 0 || failedChangeLogs > 0) {
    throw new Error(
      `Imported ${tireSets.length - failedTireSets}/${tireSets.length} tire sets and ` +
        `${changeLogs.length - failedChangeLogs}/${changeLogs.length} change logs; ` +
        `${failedTireSets + failedChangeLogs} failed`
    );
  }

  return { tireSetIdMap: exportIdToNewId };
}

type ImportPayload = {
  tireSets: ImportTireSetRow[];
  changeLogs: ImportChangeLogRow[];
  /** Map from original export ID to tire set name (for linking change logs) */
  tireSetIdMap?: Map<string, string>;
};

export function useImportTires(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportPayload) => importTires(vehicleId, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tires', vehicleId] });
      qc.invalidateQueries({ queryKey: ['tireChangeHistory', vehicleId] });
    },
  });
}

export function useImportTiresToVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportPayload & { vehicleId: string }) => {
      if (!data.vehicleId) {
        throw new Error('Vehicle ID is required to import tires');
      }
      const { vehicleId, ...rest } = data;
      return importTires(vehicleId, rest);
    },
    onSettled: (_data, _error, vars) => {
      const vehicleId = vars?.vehicleId;
      if (!vehicleId) return;
      qc.invalidateQueries({ queryKey: ['tires', vehicleId] });
      qc.invalidateQueries({ queryKey: ['tireChangeHistory', vehicleId] });
    },
  });
}
