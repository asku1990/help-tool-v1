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

export function useImportTires(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      tireSets: ImportTireSetRow[];
      changeLogs: ImportChangeLogRow[];
      /** Map from original export ID to tire set name (for linking change logs) */
      tireSetIdMap?: Map<string, string>;
    }) => {
      const { tireSets, changeLogs } = data;
      const exportIdToName = data.tireSetIdMap ?? new Map<string, string>();

      // Map from tire set name to new ID (filled after creation)
      const nameToNewId = new Map<string, string>();

      // First, create all tire sets and build name -> newId map
      const tireSetResults = await Promise.allSettled(
        tireSets.map(async ts => {
          const result = await createTireSet(vehicleId, {
            name: ts.name,
            type: ts.type,
            status: ts.status,
            purchaseDate: ts.purchaseDate,
            notes: ts.notes,
          });
          return { name: ts.name, newId: result.id };
        })
      );

      const failedTireSets = tireSetResults.filter(r => r.status === 'rejected').length;

      // Build name -> newId map from successful creations
      for (const result of tireSetResults) {
        if (result.status === 'fulfilled') {
          nameToNewId.set(result.value.name, result.value.newId);
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

      // Then, create all change logs with properly mapped tire set IDs
      const changeLogResults = await Promise.allSettled(
        changeLogs.map(async cl => {
          // First try exportId -> newId, then name -> newId, then use original
          const tireSetId =
            exportIdToNewId.get(cl.tireSetId) ?? nameToNewId.get(cl.tireSetId) ?? cl.tireSetId;
          return logTireChange(vehicleId, {
            tireSetId,
            date: cl.date,
            odometerKm: cl.odometerKm,
            notes: cl.notes,
          });
        })
      );

      const failedChangeLogs = changeLogResults.filter(r => r.status === 'rejected').length;

      if (failedTireSets > 0 || failedChangeLogs > 0) {
        throw new Error(
          `Imported ${tireSets.length - failedTireSets}/${tireSets.length} tire sets and ` +
            `${changeLogs.length - failedChangeLogs}/${changeLogs.length} change logs; ` +
            `${failedTireSets + failedChangeLogs} failed`
        );
      }

      return { tireSetIdMap: exportIdToNewId };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tires', vehicleId] });
      qc.invalidateQueries({ queryKey: ['tireChangeHistory', vehicleId] });
    },
  });
}
