import { describe, expect, it } from 'vitest';
import {
  scoreMatch,
  suggestGroups,
  suggestMatches,
  type Obligation,
  type Movement,
} from '../src/server/reconciliation/engine';
import { validateStatement } from '../src/server/banking/parser';

const invoice: Obligation = {
  id: 'invoice',
  type: 'invoice',
  party: 'Vendor',
  number: 'INV-123',
  reference: '',
  description: '',
  date: '2026-09-01',
  currency: 'MYR',
  direction: 'out',
  outstanding: 10000,
};
const payment: Movement = {
  id: 'payment',
  date: '2026-09-30',
  description: 'Vendor INV-123',
  reference: '',
  currency: 'MYR',
  direction: 'out',
  remaining: 10000,
};

describe('Statement month matching', () => {
  it('suggests approved obligations from the same calendar month, even 29 days apart', () => {
    expect(suggestMatches([invoice], [payment])).toHaveLength(1);
    expect(suggestMatches([{ ...invoice, type: 'claim' }], [payment])).toHaveLength(1);
  });

  it.each(['2026-08-31', '2026-10-01', '2025-09-01', '', '2026-09-31'])(
    'excludes a target dated %s, even with matching identity and payment history',
    (date) => {
      expect(
        suggestMatches(
          [{ ...invoice, date }],
          [payment],
          new Map([['Vendor', new Set(['vendor'])]]),
        ),
      ).toEqual([]);
    },
  );

  it('does not combine payments or split invoices across month boundaries', () => {
    const half = { ...payment, remaining: 5000 };
    expect(suggestGroups([invoice], [half, { ...half, id: 'other', date: '2026-10-01' }])).toEqual(
      [],
    );
    expect(suggestGroups([invoice], [half, { ...half, id: 'other' }])).toHaveLength(1);
    const small = { ...invoice, outstanding: 5000 };
    expect(
      suggestGroups([small, { ...small, id: 'other', date: '2026-08-31' }], [payment]),
    ).toEqual([]);
    expect(suggestGroups([small, { ...small, id: 'other' }], [payment])).toHaveLength(1);
  });

  it('keeps the identity scoring usable for manual late-payment review', () => {
    expect(scoreMatch({ ...invoice, date: '2026-08-31' }, payment)).not.toBeNull();
  });

  it('rejects statement rows outside the chosen month and year', () => {
    const draft = {
      opening: null,
      closing: null,
      notes: '',
      rows: [
        {
          date: '2026-09-30',
          description: 'Vendor',
          reference: '',
          moneyIn: '0',
          moneyOut: '100',
          balance: null,
        },
      ],
    };
    expect(validateStatement(draft, '2026-09').errors).toEqual([]);
    for (const month of ['2026-08', '2025-09']) {
      const result = validateStatement(draft, month);
      expect(result.rows).toEqual([]);
      expect(result.errors).toContain('Row 1: date is outside selected month');
    }
  });
});
