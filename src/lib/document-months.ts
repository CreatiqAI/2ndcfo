/** Group by evidenced invoice date only; never substitute the upload timestamp. */
export function documentMonth(date: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return date.slice(0, 7);
}

export function monthLabel(key: string): string {
  if (key === 'undated') return 'Date needed';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}-01T12:00:00Z`));
}

export function groupByDocumentMonth<T extends { invoiceDate: string | null }>(
  rows: T[],
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = documentMonth(row.invoiceDate) || 'undated';
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === 'undated' ? 1 : b === 'undated' ? -1 : b.localeCompare(a),
  );
}
