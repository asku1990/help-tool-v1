import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RestoreBackupDialog from '../RestoreBackupDialog';

const vehicleCsv = '[VEHICLE]\nId;Name\nv1;Car A';
const activeSetCsv = '[TIRE_SETS]\nId;Name;Type;Status\nts1;Summer Tires;SUMMER;ACTIVE';
const storedSetCsv = '[TIRE_SETS]\nId;Name;Type;Status\nts2;Winter Tires;WINTER;STORED';
const changeLogCsv = '[CHANGE_LOGS]\nId;TireSetId;Date;OdometerKm\ncl1;ts2;2024-01-15;10000';

function parseBackup(csv: string) {
  fireEvent.change(screen.getByLabelText('Or paste CSV content'), { target: { value: csv } });
  fireEvent.click(screen.getByRole('button', { name: 'Parse' }));
}

describe('RestoreBackupDialog', () => {
  it.each([
    ['active tire set', activeSetCsv, /Summer Tires/],
    ['tire change entry', `${storedSetCsv}\n${changeLogCsv}`, /2024-01-15/],
  ])('warns when importing a selected %s into an existing vehicle', (_, csv, rowName) => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <RestoreBackupDialog forVehicleId="v1" open hideTrigger />
      </QueryClientProvider>
    );

    parseBackup(csv);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /change which tire set is marked as mounted/i
    );
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();

    const row = screen.getByRole('row', { name: rowName });
    fireEvent.click(within(row).getByRole('checkbox'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns only after choosing to restore to an existing vehicle', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <RestoreBackupDialog existingVehicles={[{ id: 'v1', name: 'Car A' }]} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restore Backup' }));
    parseBackup(`${vehicleCsv}\n${activeSetCsv}`);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /update existing vehicle/i }));
    expect(screen.getByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: /create new vehicle/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
