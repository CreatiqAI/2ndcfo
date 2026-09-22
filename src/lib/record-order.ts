type DateValue = string | Date | null | undefined;
const key = (value: DateValue) => (value instanceof Date ? value.toISOString() : value || '');

/** Newest business date first; missing dates last, with deterministic ties. */
export function newestFirst<T extends { id: string; createdAt?: DateValue }>(
  rows: T[],
  date: (row: T) => DateValue,
): T[] {
  return [...rows].sort(
    (a, b) =>
      key(date(b)).localeCompare(key(date(a))) ||
      key(b.createdAt).localeCompare(key(a.createdAt)) ||
      a.id.localeCompare(b.id),
  );
}
