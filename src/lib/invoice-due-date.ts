import { documentMonth } from './document-months';

export function uploadPaymentTerms(
  item: { kind: string; dueDate: string | null; paymentTerms: string | null },
  days: number | null,
) {
  if (
    item.paymentTerms?.trim() ||
    item.dueDate ||
    days === null ||
    !['Sales Invoice', 'Supplier Invoice'].includes(item.kind)
  )
    return item.paymentTerms;
  return `${days} days`;
}

/** Derive only unambiguous calendar-day terms; retain the original stored fields. */
export function invoiceDueDate(invoice: {
  dueDate: string | null;
  invoiceDate: string | null;
  paymentTerms: string | null;
}): { date: string | null; source: 'explicit' | 'terms' | null } {
  if (invoice.dueDate) {
    return { date: documentMonth(invoice.dueDate) ? invoice.dueDate : null, source: 'explicit' };
  }
  if (!documentMonth(invoice.invoiceDate)) return { date: null, source: null };
  const terms = (invoice.paymentTerms || '').trim();
  const match =
    /^(?:net\s+(\d{1,3})(?:\s+days?)?|(\d{1,3})\s+days?(?:\s+(?:from|after)\s+(?:the\s+)?invoice\s+date)?)\.?$/i.exec(
      terms,
    );
  if (!match) return { date: null, source: null };
  const date = new Date(`${invoice.invoiceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(match[1] ?? match[2]));
  return { date: date.toISOString().slice(0, 10), source: 'terms' };
}
