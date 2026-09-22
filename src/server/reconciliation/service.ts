import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import {
  allocations,
  bankTransactions,
  claims,
  invoiceCancellations,
  invoices,
  statements,
} from '../db/schema';
import {
  type Actor,
  assert,
  audit,
  categories,
  lockCompany,
  openPeriod,
  requireRole,
  sumMinor,
} from '../core';
export async function confirmAllocations(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z
    .object({
      items: z
        .array(
          z.object({
            bankId: z.uuid(),
            targetId: z.uuid(),
            targetType: z.enum(['invoice', 'claim']),
            amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          }),
        )
        .min(1)
        .max(100),
      reason: z.string().trim().min(3).max(1000),
    })
    .parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    for (const item of data.items) {
      const [bank] = await tx
        .select()
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.id, item.bankId),
            eq(bankTransactions.companyId, actor.companyId),
          ),
        );
      assert(bank, 'Bank transaction not found.', 404);
      assert(!bank.category, 'This bank transaction is already categorised directly.');
      await openPeriod(tx, actor.companyId, bank.date);
      const already = await tx
        .select()
        .from(allocations)
        .where(eq(allocations.companyId, actor.companyId));
      const used = sumMinor(
        already.filter((x) => x.bankTransactionId === bank.id).map((x) => x.amountMinor),
      );
      assert(
        item.amountMinor <= bank.amountMinor - used,
        'Allocation exceeds the bank transaction’s remaining amount.',
        409,
      );
      let total: number, currency: string, direction: string, date: string, paid: number;
      if (item.targetType === 'invoice') {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, item.targetId), eq(invoices.companyId, actor.companyId)));
        assert(
          invoice &&
            invoice.reviewStatus === 'Approved' &&
            !invoice.claimId &&
            invoice.lifecycle !== 'Cancelled',
          'Select an approved invoice; claim receipts cannot be paid separately.',
        );
        const [cancelled] = await tx
          .select()
          .from(invoiceCancellations)
          .where(eq(invoiceCancellations.invoiceId, invoice.id));
        assert(!cancelled, 'This invoice was cancelled.');
        total = invoice.totalMinor!;
        currency = invoice.currency!;
        direction = invoice.kind === 'Sales Invoice' ? 'in' : 'out';
        date = invoice.invoiceDate!;
        const [statement] = await tx
          .select({ month: statements.month })
          .from(statements)
          .where(
            and(eq(statements.id, bank.statementId), eq(statements.companyId, actor.companyId)),
          );
        assert(
          statement && date?.slice(0, 7) === statement.month,
          'Select an invoice from the bank statement’s month and year.',
        );
        paid = sumMinor(
          already.filter((x) => x.invoiceId === invoice.id).map((x) => x.amountMinor),
        );
      } else {
        const [claim] = await tx
          .select()
          .from(claims)
          .where(and(eq(claims.id, item.targetId), eq(claims.companyId, actor.companyId)));
        assert(
          claim?.status === 'Finance Approved',
          'Only Finance-approved claims can be settled.',
        );
        total = claim.claimedMinor;
        currency = claim.currency;
        direction = 'out';
        date = claim.month;
        paid = sumMinor(already.filter((x) => x.claimId === claim.id).map((x) => x.amountMinor));
      }
      await openPeriod(tx, actor.companyId, date);
      assert(currency === bank.currency, 'Cross-currency allocation is not supported.');
      assert(direction === bank.direction, 'Payment direction does not match this record.');
      assert(
        item.amountMinor <= total - paid,
        'Allocation exceeds the invoice / claim outstanding amount.',
        409,
      );
      const [allocation] = await tx
        .insert(allocations)
        .values({
          companyId: actor.companyId,
          bankTransactionId: bank.id,
          invoiceId: item.targetType === 'invoice' ? item.targetId : null,
          claimId: item.targetType === 'claim' ? item.targetId : null,
          amountMinor: item.amountMinor,
          createdBy: actor.userId,
          reason: data.reason,
        })
        .returning();
      await audit(
        tx,
        actor,
        allocation.id,
        'reconciliation.confirmed',
        null,
        allocation,
        data.reason,
      );
    }
    return { confirmed: data.items.length };
  });
}
export async function categoriseBank(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z
    .object({ id: z.uuid(), category: z.string(), reason: z.string().trim().min(3).max(1000) })
    .parse(input);
  assert(categories.includes(data.category), 'Select a category.');
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [bank] = await tx
      .select()
      .from(bankTransactions)
      .where(
        and(eq(bankTransactions.id, data.id), eq(bankTransactions.companyId, actor.companyId)),
      );
    assert(bank, 'Bank transaction not found.', 404);
    assert(!bank.category, 'This transaction was already categorised.');
    await openPeriod(tx, actor.companyId, bank.date);
    const links = await tx
      .select()
      .from(allocations)
      .where(eq(allocations.bankTransactionId, bank.id));
    assert(
      !links.length,
      'An allocated bank transaction cannot also be categorised as a standalone expense.',
    );
    await tx
      .update(bankTransactions)
      .set({ category: data.category })
      .where(eq(bankTransactions.id, bank.id));
    await audit(
      tx,
      actor,
      bank.id,
      'bank.categorised',
      bank,
      { ...bank, category: data.category },
      data.reason,
    );
    return { ok: true };
  });
}
