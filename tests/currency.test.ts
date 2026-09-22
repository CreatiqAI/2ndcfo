import { describe, expect, it } from 'vitest';
import { convertMinor, invoiceCurrency } from '../src/lib/currency';
describe('Invoice currency and MYR conversion', () => {
  it('defaults missing currency to MYR and preserves detected foreign currency', () => {
    expect(invoiceCurrency(null)).toBe('MYR');
    expect(invoiceCurrency('')).toBe('MYR');
    expect(invoiceCurrency(' usd ')).toBe('USD');
    expect(invoiceCurrency('MYR', 'SGD')).toBe('SGD');
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
