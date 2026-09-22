import { describe, expect, it } from 'vitest';
import { invoiceDueDate, uploadPaymentTerms } from '../src/lib/invoice-due-date';

const invoice = { invoiceDate: '2026-07-28', dueDate: null, paymentTerms: '14 days' };
describe('Invoice due date fallback', () => {
  it('applies upload defaults only to invoices missing their own terms and date', () => {
    const item = { kind: 'Sales Invoice', paymentTerms: null, dueDate: null };
    expect(uploadPaymentTerms(item, 14)).toBe('14 days');
    expect(uploadPaymentTerms({ ...item, kind: 'Supplier Invoice' }, 0)).toBe('0 days');
    expect(uploadPaymentTerms({ ...item, paymentTerms: '60 days' }, 14)).toBe('60 days');
    expect(uploadPaymentTerms({ ...item, dueDate: '2026-10-01' }, 14)).toBeNull();
    expect(uploadPaymentTerms({ ...item, kind: 'Receipt' }, 14)).toBeNull();
    expect(uploadPaymentTerms(item, null)).toBeNull();
  });
  it('derives M-Plan calendar terms without changing evidence', () => {
    expect(invoiceDueDate(invoice)).toEqual({ date: '2026-08-11', source: 'terms' });
    expect(invoice.dueDate).toBeNull();
  });
  it.each([
    'Net 14',
    'NET 14 DAYS',
    '14 days from invoice date',
    '14 days after the invoice date.',
  ])('supports explicit invoice-day terms: %s', (paymentTerms) => {
    expect(invoiceDueDate({ ...invoice, paymentTerms }).date).toBe('2026-08-11');
  });
  it('gives the explicit due date priority over terms', () => {
    expect(invoiceDueDate({ ...invoice, dueDate: '2026-09-01' })).toEqual({
      date: '2026-09-01',
      source: 'explicit',
    });
  });
  it.each([
    '',
    '14 business days',
    '14 days from delivery',
    'Net 30 EOM',
    '2/10 net 30',
    'upon receipt',
    '14-30 days',
  ])('does not guess ambiguous terms: %s', (paymentTerms) => {
    expect(invoiceDueDate({ ...invoice, paymentTerms }).date).toBeNull();
  });
  it('handles leap days and year boundaries in UTC', () => {
    expect(
      invoiceDueDate({ ...invoice, invoiceDate: '2028-02-28', paymentTerms: '1 day' }).date,
    ).toBe('2028-02-29');
    expect(invoiceDueDate({ ...invoice, invoiceDate: '2026-12-28' }).date).toBe('2027-01-11');
    expect(invoiceDueDate({ ...invoice, invoiceDate: '2026-02-30' }).date).toBeNull();
    expect(invoiceDueDate({ ...invoice, invoiceDate: null }).date).toBeNull();
  });
});
