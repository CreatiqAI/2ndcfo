import { describe, expect, it } from 'vitest';
import { documentMonth, groupByDocumentMonth, monthLabel } from '../src/lib/document-months';

describe('document month organisation', () => {
  it('uses invoice dates rather than upload dates and distinguishes years', () => {
    const rows = [
      { id: 'late-upload', invoiceDate: '2026-09-30', createdAt: '2026-10-15' },
      { id: 'old-year', invoiceDate: '2025-09-01', createdAt: '2026-10-15' },
      { id: 'missing', invoiceDate: null, createdAt: '2026-09-01' },
    ];
    expect(
      groupByDocumentMonth(rows).map(([key, invoices]) => [key, invoices.map((i) => i.id)]),
    ).toEqual([
      ['2026-09', ['late-upload']],
      ['2025-09', ['old-year']],
      ['undated', ['missing']],
    ]);
    expect(monthLabel('2026-09')).toBe('September 2026');
  });
  it('keeps impossible or incomplete dates out of calendar months', () => {
    for (const value of [
      null,
      '',
      '2026-02-30',
      '2026-02-29',
      '2026-13-01',
      '2026-09',
      '09/01/2026',
    ])
      expect(documentMonth(value)).toBeNull();
    expect(documentMonth('2024-02-29')).toBe('2024-02');
  });
  it('regroups a corrected date without changing the original records', () => {
    const original = [
      { id: 'a', invoiceDate: null },
      { id: 'b', invoiceDate: '2026-09-01' },
    ];
    const corrected = original.map((i) => (i.id === 'a' ? { ...i, invoiceDate: '2026-09-20' } : i));
    expect(groupByDocumentMonth(corrected)[0][1]).toHaveLength(2);
    expect(original[0].invoiceDate).toBeNull();
    expect(groupByDocumentMonth([])).toEqual([]);
  });
});
