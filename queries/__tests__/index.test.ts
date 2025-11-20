import * as queries from '@/queries';

describe('queries index barrel', () => {
  it('re-exports expected helpers', () => {
    expect(queries.vehicleKeys).toBeDefined();
    expect(queries.listVehicles).toBeInstanceOf(Function);
    expect(queries.listExpenses).toBeInstanceOf(Function);
    expect(queries.listFillUps).toBeInstanceOf(Function);
  });
});
