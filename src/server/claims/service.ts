import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DB } from '../db';
import { claims, documents, invoices, jobs, memberships } from '../db/schema';
import {
  type Actor,
  assert,
  audit,
  currencies,
  lockCompany,
  minor,
  openPeriod,
  requireRole,
  sumMinor,
} from '../core';
import { myrRate } from '../fx';
import { convertMinorCross } from '../../lib/currency';
export async function claimSummary(
  claim: typeof claims.$inferSelect,
  receipts: (typeof invoices.$inferSelect)[],
  executor?: Pick<DB, 'select' | 'insert'>,
) {
  const active = receipts.filter((x) => x.reviewStatus !== 'Rejected');
  const receiptConversions = await Promise.all(
    active.map(async (receipt) => {
      const currency = receipt.currency || '';
      if (currency === claim.currency)
        return {
          id: receipt.id,
          originalCurrency: currency,
          amountMinor: receipt.totalMinor,
          sourceRate: '1',
          targetRate: '1',
          rateDate: receipt.invoiceDate,
          source: 'Same currency',
        };
      const [source, target] = await Promise.all([
        currency === 'MYR' ? null : myrRate(currency, receipt.invoiceDate, executor),
        claim.currency === 'MYR' ? null : myrRate(claim.currency, receipt.invoiceDate, executor),
      ]);
      const sourceRate = currency === 'MYR' ? '1' : source?.rate;
      const targetRate = claim.currency === 'MYR' ? '1' : target?.rate;
      let amountMinor: number | null = null;
      if (sourceRate && targetRate && receipt.totalMinor !== null) {
        try {
          amountMinor = convertMinorCross(receipt.totalMinor, sourceRate, targetRate);
        } catch {
          /* Flag unavailable; never silently assume parity. */
        }
      }
      return {
        id: receipt.id,
        originalCurrency: currency,
        amountMinor,
        sourceRate: sourceRate || null,
        targetRate: targetRate || null,
        rateDate: source?.rateDate || target?.rateDate || null,
        source: source?.source || target?.source || null,
      };
    }),
  );
  const converted = new Map(receiptConversions.map((r) => [r.id, r.amountMinor]));
  const fxMissing = receiptConversions.filter(
    (r) => r.originalCurrency !== claim.currency && r.amountMinor === null,
  ).length;
  const total = sumMinor(active.map((x) => converted.get(x.id) || 0));
  const effectiveClaimedMinor =
    claim.autoTotal && ['Draft', 'Needs Review'].includes(claim.status)
      ? total
      : claim.claimedMinor;
  const difference = effectiveClaimedMinor - total;
  const unknown = active.filter(
    (x) =>
      !x.totalMinor ||
      !x.party ||
      !x.currency ||
      !x.invoiceDate ||
      !x.category ||
      converted.get(x.id) === null ||
      (x.subtotalMinor !== null &&
        x.taxMinor !== null &&
        BigInt(x.subtotalMinor) + BigInt(x.taxMinor) !== BigInt(x.totalMinor || 0)),
  ).length;
  const duplicates = active.filter((x) => x.duplicateOf).length;
  const categories: Record<string, number> = {};
  for (const r of active)
    categories[r.category || 'Unknown'] = sumMinor([
      categories[r.category || 'Unknown'] || 0,
      converted.get(r.id) || 0,
    ]);
  return {
    receiptTotal: total,
    receiptConversions,
    fxMissing,
    effectiveClaimedMinor,
    difference,
    unknown,
    duplicates,
    receiptCount: active.length,
    categories,
    needsReview: difference !== 0 || unknown > 0 || duplicates > 0 || active.length === 0,
  };
}
export async function createClaim(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance', 'Manager', 'Employee']);
  const data = z
    .object({
      title: z.string().trim().min(2).max(160),
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      claimed: z.string(),
      currency: z.enum(currencies),
      employeeId: z.uuid().optional(),
      autoTotal: z.boolean().default(false),
    })
    .parse(input);
  const claimedMinor = minor(data.claimed);
  assert(claimedMinor >= 0, 'Claimed amount cannot be negative.');
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    await openPeriod(tx, actor.companyId, data.month);
    const employeeId = data.employeeId || actor.userId;
    if (employeeId !== actor.userId) requireRole(actor, ['Admin', 'Finance']);
    const [member] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.companyId, actor.companyId), eq(memberships.userId, employeeId)));
    assert(member, 'Employee must belong to this workspace.');
    const [claim] = await tx
      .insert(claims)
      .values({
        companyId: actor.companyId,
        employeeId,
        title: data.title,
        month: data.month,
        claimedMinor,
        autoTotal: data.autoTotal,
        currency: data.currency,
        department: member.department,
      })
      .returning();
    await audit(tx, actor, claim.id, 'claim.created', null, claim);
    return claim;
  });
}
export async function changeClaim(actor: Actor, input: unknown) {
  const data = z
    .object({
      id: z.uuid(),
      action: z.enum(['submit', 'manager', 'finance', 'reject', 'request', 'adjust']),
      reason: z.string().trim().max(1000).default(''),
      claimed: z.string().optional(),
    })
    .parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [claim] = await tx
      .select()
      .from(claims)
      .where(and(eq(claims.id, data.id), eq(claims.companyId, actor.companyId)));
    assert(claim, 'Claim not found.', 404);
    await openPeriod(tx, actor.companyId, claim.month);
    assert(
      !['Finance Approved', 'Rejected'].includes(claim.status),
      'This claim is locked. Create a corrected claim with an audit reference.',
      409,
    );
    const receipts = await tx.select().from(invoices).where(eq(invoices.claimId, claim.id));
    const pending = await tx
      .select({ status: jobs.status })
      .from(jobs)
      .innerJoin(documents, eq(documents.id, jobs.documentId))
      .where(eq(documents.claimId, claim.id));
    const summary = await claimSummary(claim, receipts, tx);
    const update: Partial<typeof claims.$inferInsert> =
      claim.autoTotal && ['Draft', 'Needs Review'].includes(claim.status)
        ? { claimedMinor: summary.effectiveClaimedMinor }
        : {};
    const owns = actor.userId === claim.employeeId;
    const finance = ['Admin', 'Finance'].includes(actor.role);
    if (data.action === 'submit' || data.action === 'adjust') {
      assert(owns || finance, 'You can only submit or adjust your own claims.', 403);
      assert(
        ['Draft', 'Needs Review'].includes(claim.status),
        'Only draft/review claims can be changed.',
      );
      if (data.action === 'adjust') {
        assert(
          data.claimed !== undefined && data.reason.length >= 3,
          'Enter an amount and adjustment reason.',
        );
        update.claimedMinor = minor(data.claimed);
        update.autoTotal = false;
        assert(update.claimedMinor >= 0, 'Claim amount cannot be negative.');
      } else {
        assert(
          !pending.some((x) => x.status !== 'complete'),
          'Finish extracting all receipts before submitting.',
        );
        update.status = summary.needsReview ? 'Needs Review' : 'Submitted';
        if (claim.autoTotal) update.claimedMinor = summary.receiptTotal;
      }
    } else {
      if (actor.role === 'Manager')
        assert(
          actor.department && claim.department === actor.department,
          'This claim is outside your department.',
          403,
        );
      if (data.action === 'manager') {
        requireRole(actor, ['Admin', 'Manager']);
        assert(
          ['Submitted', 'Needs Review'].includes(claim.status),
          'Submit this claim before manager approval.',
        );
        assert(
          !owns || (actor.role === 'Admin' && data.reason.length >= 10),
          'Self-approval is blocked; an Admin override requires an explicit reason.',
          403,
        );
        assert(
          summary.unknown === 0,
          'Complete receipt fields and resolve unavailable exchange rates before approval.',
        );
        assert(
          !summary.needsReview || data.reason.length >= 10,
          'Receipt differences or duplicates require an explicit exception reason.',
        );
        assert(!pending.some((x) => x.status !== 'complete'), 'Finish extraction before approval.');
        update.status = 'Manager Approved';
        update.managerId = actor.userId;
      } else if (data.action === 'finance') {
        requireRole(actor, ['Admin', 'Finance']);
        assert(claim.status === 'Manager Approved', 'Manager approval is required first.');
        assert(
          !owns || (actor.role === 'Admin' && data.reason.length >= 10),
          'Self-approval requires an Admin override reason.',
          403,
        );
        assert(summary.unknown === 0, 'Receipt fields are incomplete.');
        assert(
          !summary.needsReview || data.reason.length >= 10,
          'Document differences or duplicates require an exception reason.',
        );
        update.status = 'Finance Approved';
        update.financeId = actor.userId;
      } else {
        requireRole(actor, ['Admin', 'Finance', 'Manager']);
        assert(data.reason.length >= 3, 'Enter a reason.');
        update.status = data.action === 'reject' ? 'Rejected' : 'Needs Review';
        update.managerId = null;
        update.financeId = null;
      }
    }
    if (data.reason) update.exceptionReason = data.reason;
    const [after] = await tx.update(claims).set(update).where(eq(claims.id, claim.id)).returning();
    await audit(
      tx,
      actor,
      claim.id,
      `claim.${data.action}`,
      claim,
      { ...after, receiptConversions: summary.receiptConversions },
      data.reason,
    );
    return after;
  });
}
