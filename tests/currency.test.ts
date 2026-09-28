import { describe, expect, it } from 'vitest';
import { convertMinor, convertMinorCross, invoiceCurrency } from '../src/lib/currency';
describe('Invoice currency and MYR conversion', () => {
  it('converts cross currencies with one final rounding', () => {
    expect(convertMinorCross(10000, '4.25', '1')).toBe(42500);
    expect(convertMinorCross(42500, '1', '4.25')).toBe(10000);
    expect(convertMinorCross(10000, '4.25', '3.2')).toBe(13281);
    expect(() => convertMinorCross(100, '1', '0')).toThrow();
  });
  it('keeps missing currency unknown and preserves detected foreign currency', () => {
    expect(invoiceCurrency(null)).toBeNull();
    expect(invoiceCurrency('')).toBeNull();
    expect(invoiceCurrency(' usd ')).toBe('USD');
    expect(invoiceCurrency('MYR')).toBe('MYR');
  });
  it('rounds MYR cents exactly rather than using floating point money', () => {
    expect(convertMinor(10000, '4.2517')).toBe(42517);
    expect(convertMinor(1, '0.5')).toBe(1);
    expect(convertMinor(29, '1')).toBe(29);
    expect(convertMinor(0, '4.3')).toBe(0);
    expect(() => convertMinor(Number.MAX_SAFE_INTEGER, '2')).toThrow('precision');
    expect(() => convertMinor(100, '0')).toThrow();
    expect(() => convertMinor(100, '-1')).toThrow();
  });
});
