import { toast } from 'sonner';
import { useCreateTireSet, useUpdateTireSet } from '@/hooks';
import type { TireSetDto } from '@/queries/tires';
import { TireEditorDialog, readTireField, tireFieldClass } from './TireEditorDialog';
import { tireDateInput, tireTypeLabels } from './tireDisplay';

export function TireSetDialog({
  vehicleId,
  set,
  onClose,
  onCloseAutoFocus,
}: {
  vehicleId: string;
  set?: TireSetDto;
  onClose: () => void;
  onCloseAutoFocus: (_event: Event) => void;
}) {
  const createSet = useCreateTireSet(vehicleId);
  const updateSet = useUpdateTireSet(vehicleId);

  async function saveSet(fields: FormData) {
    const name = readTireField(fields, 'name');
    const type = readTireField(fields, 'type');
    if (!name) throw new Error('Enter a name for this tire set.');
    if (type !== 'SUMMER' && type !== 'WINTER' && type !== 'ALL_SEASON') {
      throw new Error('Choose a tire type.');
    }
    const purchaseDate = readTireField(fields, 'purchaseDate');
    const notes = readTireField(fields, 'notes');
    if (set) {
      await updateSet.mutateAsync({
        tireSetId: set.id,
        name,
        type,
        purchaseDate: purchaseDate || null,
        notes: notes || null,
      });
      toast.success('Tire set updated');
    } else {
      await createSet.mutateAsync({
        name,
        type,
        purchaseDate: purchaseDate || undefined,
        notes: notes || undefined,
      });
      toast.success('Tire set added');
    }
  }

  return (
    <TireEditorDialog
      title={set ? 'Edit tire set' : 'Add tire set'}
      description={
        set
          ? 'Update the details for this set.'
          : 'Save the set now and mount it when you’re ready.'
      }
      submitLabel={set ? 'Save changes' : 'Add tire set'}
      onSave={saveSet}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <label className="block text-sm font-medium">
        Name
        <input
          className={tireFieldClass}
          name="name"
          required
          maxLength={100}
          defaultValue={set?.name}
          placeholder="e.g. Nokian Hakkapeliitta"
        />
      </label>
      <label className="block text-sm font-medium">
        Type
        <select className={tireFieldClass} name="type" defaultValue={set?.type ?? 'SUMMER'}>
          {Object.entries(tireTypeLabels).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Purchase date (optional)
        <input
          className={tireFieldClass}
          type="date"
          name="purchaseDate"
          defaultValue={set?.purchaseDate ? tireDateInput(set.purchaseDate) : ''}
        />
      </label>
      <label className="block text-sm font-medium">
        Notes (optional)
        <textarea
          className={tireFieldClass}
          name="notes"
          maxLength={500}
          rows={3}
          defaultValue={set?.notes ?? ''}
          placeholder="e.g. Tread 6 mm, even wear"
        />
      </label>
    </TireEditorDialog>
  );
}
