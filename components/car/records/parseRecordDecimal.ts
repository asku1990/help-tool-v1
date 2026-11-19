export function parseRecordDecimal(value: string): number {
  return parseFloat(value.replace(',', '.'));
}
