export function escapeCsvField(value: string): string {
  const mustQuote = /[";\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

export function sanitizeForFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
