import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { allocations, claims, documents, invoiceCancellations, invoices } from '../db/schema';
import {
  type Actor,
  assert,
  audit,
  categories,
  currencies,
  lockCompany,
  minor,
  normal,
  openPeriod,
  requireRole,
  validDate,
} from '../core';
const nullable = z.string().trim().max(2000).nullable();
const reviewSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  action: z.enum(['save', 'approve', 'reject', 'review']),
  reason: z.string().trim().max(1000).default(''),
  fields: z
    .object({
      kind: z.enum([
        'Sales Invoice',
        'Supplier Invoice',
        'Receipt',
        'Claim Receipt',
        'Other Financial Document',
      ]),
      party: nullable,
      number: nullable,
      invoiceDate: nullable,
      dueDate: nullable,
      description: nullable,
      product: nullable,
      paymentTerms: nullable,
      bankReference: nullable,
      subtotal: nullable,
      tax: nullable,
      total: nullable,
      currency: nullable,
      category: nullable,
    })
    .optional(),
});
export async function reviewInvoice(actor: Actor, input: unknown) {
  const data = reviewSchema.parse(input),
    db = await getDb();
  return db.transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [before] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, data.id), eq(invoices.companyId, actor.companyId)));
    assert(before, 'Invoice not found.', 404);
    assert(
      before.reviewStatus !== 'Approved',
      'Approved records require an amendment; they cannot be overwritten.',
      409,
    );
    assert(before.version === data.version, 'This record changed. Refresh before reviewing.', 409);
    if (before.claimId) {
      const [claim] = await tx.select().from(claims).where(eq(claims.id, before.claimId));
      assert(claim.status !== 'Finance Approved', 'Approved claim evidence is locked.', 409);
      if (!['Admin', 'Finance'].includes(actor.role)) {
        assert(
          claim.employeeId === actor.userId &&
            ['Draft', 'Needs Review'].includes(claim.status) &&
            data.action === 'save',
          'You can only edit your own draft receipts.',
          403,
        );
      }
      await openPeriod(tx, actor.companyId, claim.month);
    } else requireRole(actor, ['Admin', 'Finance']);
    await openPeriod(tx, actor.companyId, before.invoiceDate);
    const patch: Partial<typeof invoices.$inferInsert> = { version: before.version + 1 };
    if (data.fields) {
      const f = data.fields;
      for (const v of [f.invoiceDate, f.dueDate])
        assert(!v || validDate(v), 'Use a valid date in YYYY-MM-DD format.');
      assert(
        !f.currency || currencies.includes(f.currency as (typeof currencies)[number]),
        'Unsupported currency.',
      );
      assert(!f.category || categories.includes(f.category), 'Select a known category.');
      Object.assign(patch, {
        kind: before.claimId ? 'Claim Receipt' : f.kind,
        party: f.party || null,
        number: f.number || null,
        invoiceDate: f.invoiceDate || null,
        dueDate: f.dueDate || null,
        description: f.description || null,
        product: f.product || null,
        paymentTerms: f.paymentTerms || null,
        bankReference: f.bankReference || null,
        subtotalMinor: f.subtotal ? minor(f.subtotal) : null,
        taxMinor: f.tax ? minor(f.tax) : null,
        totalMinor: f.total ? minor(f.total) : null,
        currency: f.currency || null,
        category: f.category || null,
      });
      assert(patch.totalMinor == null || patch.totalMinor > 0, 'Total must be positive.');
      assert(
        (patch.subtotalMinor ?? 0) >= 0 && (patch.taxMinor ?? 0) >= 0,
        'Subtotal and tax cannot be negative.',
      );
      await openPeriod(tx, actor.companyId, patch.invoiceDate ?? null);
    }
    const merged = { ...before, ...patch };
    // Re-evaluate duplicate business keys after human correction, too.
    const peers = await tx.select().from(invoices).where(eq(invoices.companyId, actor.companyId));
    const duplicate = peers.find(
      (x) =>
        x.id !== before.id &&
        normal(x.number) &&
        normal(x.number) === normal(merged.number) &&
        normal(x.party) === normal(merged.party) &&
        x.totalMinor === merged.totalMinor,
    );
    if (duplicate) {
      patch.duplicateOf = duplicate.id;
      patch.duplicateReason = 'Matching invoice/receipt number, party and amount';
    }
    if (data.action === 'approve') {
      requireRole(actor, ['Admin', 'Finance']);
      assert(
        merged.party &&
          merged.invoiceDate &&
          merged.totalMinor &&
          merged.currency &&
          merged.category,
        'Party, date, amount, currency and category must be verified before approval.',
      );
      assert(merged.kind !== 'Other Financial Document', 'Classify this document before approval.');
      assert(
        merged.subtotalMinor == null ||
          merged.taxMinor == null ||
          merged.subtotalMinor + merged.taxMinor === merged.totalMinor,
        'Subtotal plus tax does not equal the total. Correct the amounts.',
      );
      assert(
        !(before.duplicateOf || duplicate) || data.reason.length >= 10,
        'A potential duplicate requires an explanation of at least 10 characters.',
      );
      Object.assign(patch, {
        reviewStatus: 'Approved',
        lifecycle: 'Issued',
        approvedBy: actor.userId,
        approvedAt: new Date(),
      });
    } else if (data.action === 'reject') {
      assert(data.reason.length >= 3, 'Add a reason for rejection.');
      patch.reviewStatus = 'Rejected';
    } else patch.reviewStatus = 'Needs Review';
    const [after] = await tx
      .update(invoices)
      .set(patch)
      .where(eq(invoices.id, before.id))
      .returning();
    await audit(tx, actor, after.id, `invoice.${data.action}`, before, after, data.reason);
    return after;
  });
}
export async function splitInvoice(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const { id, splitAt } = z.object({ id: z.uuid(), splitAt: z.number().int().min(2) }).parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [row] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.companyId, actor.companyId)));
    assert(row && row.reviewStatus !== 'Approved', 'Only unapproved documents can be split.');
    assert(
      splitAt > row.pageStart && splitAt <= row.pageEnd,
      'Choose a page inside the source range.',
    );
    if (row.claimId) {
      const [claim] = await tx.select().from(claims).where(eq(claims.id, row.claimId));
      assert(['Draft', 'Needs Review'].includes(claim.status), 'Claim evidence is locked.');
    }
    await openPeriod(tx, actor.companyId, row.invoiceDate);
    await tx
      .update(invoices)
      .set({ pageEnd: splitAt - 1, version: row.version + 1, reviewStatus: 'Needs Review' })
      .where(eq(invoices.id, id));
    const [newRow] = await tx
      .insert(invoices)
      .values({
        companyId: actor.companyId,
        documentId: row.documentId,
        claimId: row.claimId,
        pageStart: splitAt,
        pageEnd: row.pageEnd,
        kind: row.kind,
      })
      .returning();
    await audit(
      tx,
      actor,
      id,
      'document.split',
      { start: row.pageStart, end: row.pageEnd },
      { splitAt, newInvoiceId: newRow.id },
      'Human corrected PDF document boundaries',
    );
    return newRow;
  });
}
export async function cancelInvoice(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z.object({ id: z.uuid(), reason: z.string().trim().min(10).max(1000) }).parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, data.id), eq(invoices.companyId, actor.companyId)));
    assert(
      invoice?.reviewStatus === 'Approved' && !invoice.claimId,
      'Only standalone approved invoices can be cancelled.',
    );
    await openPeriod(tx, actor.companyId, invoice.invoiceDate);
    const payments = await tx
      .select()
      .from(allocations)
      .where(eq(allocations.invoiceId, invoice.id));
    assert(
      !payments.length,
      'A paid or partially paid invoice requires a payment reversal before cancellation.',
    );
    const [prior] = await tx
      .select()
      .from(invoiceCancellations)
      .where(eq(invoiceCancellations.invoiceId, invoice.id));
    assert(!prior, 'Invoice already cancelled.', 409);
    const [event] = await tx
      .insert(invoiceCancellations)
      .values({
        companyId: actor.companyId,
        invoiceId: invoice.id,
        actorId: actor.userId,
        reason: data.reason,
      })
      .returning();
    await audit(
      tx,
      actor,
      invoice.id,
      'invoice.cancelled',
      invoice,
      { cancellationId: event.id },
      data.reason,
    );
    return { ok: true };
  });
}
