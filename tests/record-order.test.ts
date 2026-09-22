import { describe, expect, it } from 'vitest';
import { newestFirst } from '../src/lib/record-order';

describe('record date order', () => {
  it('orders by business date, with undated records last, without mutating input', () => {
    const rows = [
      { id: 'old', date: '2025-12-31', createdAt: '2026-09-01' },
      { id: 'missing', date: null, createdAt: '2026-12-01' },
      { id: 'new', date: '2026-09-01', createdAt: '2026-09-02' },
      { id: 'mid', date: '2026-01-01', createdAt: '2026-09-03' },
    ];
    expect(newestFirst(rows, (r) => r.date).map((r) => r.id)).toEqual([
      'new',
      'mid',
      'old',
      'missing',
    ]);
    expect(rows[0].id).toBe('old');
  });
  it('handles months and timestamps with stable same-date ordering', () => {
    const rows = [
      { id: 'b', month: '2026-09', createdAt: new Date('2026-09-02') },
      { id: 'a', month: '2026-09', createdAt: new Date('2026-09-02') },
      { id: 'c', month: '2026-08', createdAt: new Date('2026-10-01') },
    ];
    expect(newestFirst(rows, (r) => r.month).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(newestFirst(rows, (r) => r.createdAt)[0].id).toBe('c');
  });
});
