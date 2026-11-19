export function escapeSpreadsheetField(value: string): string {
  // Inspect normalized text for formula markers, but write the original text.
  const normalized = value.normalize('NFKC');
  const needsPrefix = /^[\s\p{Cc}\p{Cf}']*[=+@-]/u.test(normalized) || /^\s*[\t\r\n]/.test(value);
  const text = needsPrefix ? `Text: ${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}
