// Minimal RFC4180-compliant CSV writer.
export function toCSV(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return columns ? columns.join(',') + '\n' : '';
  const cols = columns ?? Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const header = cols.map(escapeCSV).join(',');
  const body = rows.map(r => cols.map(c => escapeCSV(r[c])).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
