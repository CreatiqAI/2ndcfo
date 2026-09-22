import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from './db';
import * as s from './db/schema';
import {
  type Actor,
  assert,
  audit,
  categories,
  currencies,
  lockCompany,
  normal,
  paymentStatus,
  requireRole,
  sumMinor,
} from './core';
import { claimSummary } from './claims/service';
import { suggestGroups, suggestMatches, type Obligation } from './reconciliation/engine';
import { validateStatement } from './banking/parser';
import { bankDraftSchema } from './extraction/provider';
import { invoiceDueDate } from '../lib/invoice-due-date';
import { convertMinor } from '../lib/currency';
import { myrRate } from './fx';
export async function workspaceList(userId: string) {
  return (await getDb())
    .select({
      id: s.companies.id,
      name: s.companies.name,
      currency: s.companies.currency,
      role: s.memberships.role,
    })
    .from(s.memberships)
    .innerJoin(s.companies, eq(s.companies.id, s.memberships.companyId))
    .where(eq(s.memberships.userId, userId));
}
export async function createWorkspace(userId: string, input: unknown) {
  const { name } = z.object({ name: z.string().trim().min(2).max(100) }).parse(input);
  return (await getDb()).transaction(async (tx) => {
    const [company] = await tx.insert(s.companies).values({ name }).returning();
    await tx.insert(s.memberships).values({ companyId: company.id, userId, role: 'Admin' });
    await audit(
      tx,
      { userId, companyId: company.id, role: 'Admin', department: null },
      company.id,
      'workspace.created',
      null,
      company,
    );
    return company;
  });
}
export async function assignMember(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin']);
  const data = z
    .object({
      email: z.email().transform((x) => x.toLowerCase().trim()),
      role: z.enum(['Admin', 'Finance', 'Manager', 'Employee', 'Accountant']),
      department: z.string().trim().max(100).nullable(),
    })
    .parse(input);
  assert(data.role !== 'Manager' || data.department, 'Managers need an assigned department.');
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [user] = await tx.select().from(s.users).where(eq(s.users.email, data.email));
    assert(user, 'Ask this person to register an account first. No email is sent by this action.');
    assert(user.id !== actor.userId, 'You cannot change your own role.');
    const [prior] = await tx
      .select()
      .from(s.memberships)
      .where(and(eq(s.memberships.companyId, actor.companyId), eq(s.memberships.userId, user.id)));
    const [member] = await tx
      .insert(s.memberships)
      .values({
        companyId: actor.companyId,
        userId: user.id,
        role: data.role,
        department: data.department,
      })
      .onConflictDoUpdate({
        target: [s.memberships.companyId, s.memberships.userId],
        set: { role: data.role, department: data.department },
      })
      .returning();
    await audit(tx, actor, member.id, 'membership.assigned', prior, member);
    return { ok: true };
  });
}
export function canSeeClaim(actor: Actor, claim: typeof s.claims.$inferSelect) {
  return (
    ['Admin', 'Finance', 'Accountant'].includes(actor.role) ||
    claim.employeeId === actor.userId ||
    (actor.role === 'Manager' && !!actor.department && actor.department === claim.department)
  );
}
export async function allowedDocuments(actor: Actor) {
  const db = await getDb();
  const all = await db.select().from(s.documents).where(eq(s.documents.companyId, actor.companyId));
  if (['Admin', 'Finance', 'Accountant'].includes(actor.role)) return all;
  const claims = await db.select().from(s.claims).where(eq(s.claims.companyId, actor.companyId));
  const allowed = new Set(claims.filter((c) => canSeeClaim(actor, c)).map((c) => c.id));
  return all.filter((d) => d.claimId && allowed.has(d.claimId));
}
export async function snapshot(actor: Actor) {
  const db = await getDb(),
    full = ['Admin', 'Finance', 'Accountant'].includes(actor.role);
  const [company] = await db.select().from(s.companies).where(eq(s.companies.id, actor.companyId));
  const docs = await allowedDocuments(actor),
    docIds = new Set(docs.map((x) => x.id));
  const invoices = (
    await db.select().from(s.invoices).where(eq(s.invoices.companyId, actor.companyId))
  ).filter((x) => docIds.has(x.documentId));
  const claims = (
    await db.select().from(s.claims).where(eq(s.claims.companyId, actor.companyId))
  ).filter((c) => canSeeClaim(actor, c));
  const claimIds = new Set(claims.map((x) => x.id)),
    invoiceIds = new Set(invoices.map((x) => x.id));
  const allocations = (
    await db.select().from(s.allocations).where(eq(s.allocations.companyId, actor.companyId))
  ).filter(
    (x) =>
      full ||
      (x.claimId && claimIds.has(x.claimId)) ||
      (x.invoiceId && invoiceIds.has(x.invoiceId)),
  );
  const bank = full
    ? await db
        .select()
        .from(s.bankTransactions)
        .where(eq(s.bankTransactions.companyId, actor.companyId))
    : [];
  const accounts = full
    ? await db.select().from(s.bankAccounts).where(eq(s.bankAccounts.companyId, actor.companyId))
    : [];
  const statements = full
    ? await db.select().from(s.statements).where(eq(s.statements.companyId, actor.companyId))
    : [];
  const members = await db
    .select({
      id: s.users.id,
      name: s.users.name,
      email: s.users.email,
      role: s.memberships.role,
      department: s.memberships.department,
    })
    .from(s.memberships)
    .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
    .where(eq(s.memberships.companyId, actor.companyId));
  const cancellations = await db
    .select()
    .from(s.invoiceCancellations)
    .where(eq(s.invoiceCancellations.companyId, actor.companyId));
  const trash = await db
    .select()
    .from(s.recordTrash)
    .where(and(eq(s.recordTrash.companyId, actor.companyId), eq(s.recordTrash.deleted, true)));
  const invoiceRows = await Promise.all(
    invoices.map(async (x) => {
      const currency = x.currency || 'MYR';
      const fx = x.totalMinor !== null ? await myrRate(currency, x.invoiceDate) : null;
      let myrTotalMinor: number | null = currency === 'MYR' ? x.totalMinor : null;
      if (fx && x.totalMinor !== null) {
        try {
          myrTotalMinor = convertMinor(x.totalMinor, fx.rate);
        } catch {
          /* Display unavailable on overflow. */
        }
      }
      const paidMinor = sumMinor(
        allocations.filter((a) => a.invoiceId === x.id).map((b) => b.amountMinor),
      );
      const cancellation = cancellations.find((c) => c.invoiceId === x.id);
      const due = invoiceDueDate(x);
      return {
        ...x,
        currency,
        myrTotalMinor,
        myrRate: fx?.rate || null,
        myrRateDate: fx?.rateDate || null,
        myrRateSource: fx?.source || null,
        effectiveDueDate: due.date,
        deleted: trash.some((t) => t.invoiceId === x.id || (x.claimId && t.claimId === x.claimId)),
        dueDateSource: due.source,
        lifecycle: cancellation ? 'Cancelled' : x.lifecycle,
        cancellationReason: cancellation?.reason || null,
        documentName: docs.find((d) => d.id === x.documentId)?.name || '',
        paidMinor,
        outstandingMinor: cancellation ? 0 : (x.totalMinor || 0) - paidMinor,
        isOverdue:
          !cancellation &&
          x.reviewStatus === 'Approved' &&
          (x.totalMinor || 0) > paidMinor &&
          !!due.date &&
          due.date < new Date().toISOString().slice(0, 10),
        paymentStatus: cancellation
          ? 'Cancelled'
          : x.reviewStatus === 'Approved'
            ? paymentStatus(x.totalMinor || 0, paidMinor, due.date)
            : x.reviewStatus === 'Rejected'
              ? 'Rejected'
              : 'Draft',
        bankMatch:
          paidMinor >= (x.totalMinor || Infinity)
            ? 'Matched'
            : paidMinor > 0
              ? 'Partial'
              : 'Unmatched',
      };
    }),
  );
  const claimRows = claims.map((c) => {
    const paidMinor = sumMinor(
      allocations.filter((a) => a.claimId === c.id).map((b) => b.amountMinor),
    );
    const summary = claimSummary(
      c,
      invoices.filter((i) => i.claimId === c.id),
    );
    return {
      ...c,
      deleted: trash.some((t) => t.claimId === c.id),
      ...summary,
      claimedMinor: summary.effectiveClaimedMinor,
      employeeName: members.find((m) => m.id === c.employeeId)?.name || 'Employee',
      paidMinor,
      paymentStatus:
        c.status === 'Finance Approved' ? paymentStatus(c.claimedMinor, paidMinor, null) : c.status,
    };
  });
  const bankRows = bank.map((b) => {
    const allocated = sumMinor(
      allocations.filter((a) => a.bankTransactionId === b.id).map((x) => x.amountMinor),
    );
    return {
      ...b,
      allocatedMinor: allocated,
      remaining: b.category ? 0 : b.amountMinor - allocated,
      status: b.category
        ? 'Categorised'
        : allocated >= b.amountMinor
          ? 'Matched'
          : allocated > 0
            ? 'Partial'
            : 'Unmatched',
    };
  });
  const obligations: Obligation[] = [
    ...invoiceRows
      .filter((i) => i.reviewStatus === 'Approved' && !i.claimId && i.outstandingMinor > 0)
      .map((i) => ({
        id: i.id,
        type: 'invoice' as const,
        party: i.party!,
        number: i.number || '',
        reference: i.bankReference || '',
        description: i.description || '',
        date: i.invoiceDate!,
        currency: i.currency!,
        direction: i.kind === 'Sales Invoice' ? ('in' as const) : ('out' as const),
        outstanding: i.outstandingMinor,
      })),
    ...claimRows
      .filter((c) => c.status === 'Finance Approved' && c.claimedMinor > c.paidMinor)
      .map((c) => ({
        id: c.id,
        type: 'claim' as const,
        party: c.employeeName,
        number: '',
        reference: '',
        description: c.title,
        date: `${c.month}-01`,
        currency: c.currency,
        direction: 'out' as const,
        outstanding: c.claimedMinor - c.paidMinor,
      })),
  ];
  const history = new Map<string, Set<string>>();
  for (const a of allocations) {
    const invoice = invoices.find((x) => x.id === a.invoiceId),
      b = bank.find((x) => x.id === a.bankTransactionId);
    if (invoice?.party && b) {
      const set = history.get(invoice.party) || new Set<string>();
      const key = normal(b.description);
      if (key.length >= 5) set.add(key);
      history.set(invoice.party, set);
    }
  }
  const auditRows = full
    ? await db
        .select({ event: s.auditEvents, actorName: s.users.name })
        .from(s.auditEvents)
        .innerJoin(s.users, eq(s.users.id, s.auditEvents.actorId))
        .where(eq(s.auditEvents.companyId, actor.companyId))
        .orderBy(desc(s.auditEvents.createdAt))
        .limit(200)
    : [];
  const decisions = full
    ? await db
        .select()
        .from(s.reconciliationDecisions)
        .where(eq(s.reconciliationDecisions.companyId, actor.companyId))
    : [];
  const rejected = new Set(decisions.map((a) => `${a.bankId}:${a.targetId}`));
  const suggestions = suggestMatches(obligations, bankRows, history).filter(
    (x) => !rejected.has(`${x.bankId}:${x.targetId}`),
  );
  const groups = suggestGroups(obligations, bankRows).filter((g) =>
    g.items.every((i) => !rejected.has(`${i.bankId}:${i.targetId}`)),
  );
  const jobRows = (
    await db.select().from(s.jobs).where(eq(s.jobs.companyId, actor.companyId))
  ).filter((j) => docIds.has(j.documentId));
  const extracted = (
    await db.select().from(s.extractions).where(eq(s.extractions.companyId, actor.companyId))
  ).filter((e) => docIds.has(e.documentId));
  const summaries = ['Sales Invoice', 'Supplier Invoice'].map((kind) => {
    const bankExpenses =
      kind === 'Supplier Invoice'
        ? bankRows.filter(
            (b) => b.direction === 'out' && !!b.category && b.currency === company.currency,
          )
        : [];
    const approvedClaims =
      kind === 'Supplier Invoice'
        ? claimRows.filter(
            (c) => c.status === 'Finance Approved' && c.currency === company.currency,
          )
        : [];
    const list = invoiceRows.filter(
      (x) =>
        !x.claimId &&
        x.reviewStatus === 'Approved' &&
        x.lifecycle !== 'Cancelled' &&
        (kind === 'Sales Invoice' ? x.kind === kind : x.kind !== 'Sales Invoice') &&
        x.currency === company.currency,
    );
    return {
      kind,
      total: sumMinor([
        ...list.map((x) => x.totalMinor || 0),
        ...approvedClaims.map((c) => c.claimedMinor),
        ...bankExpenses.map((b) => b.amountMinor),
      ]),
      paid: sumMinor([
        ...list.map((x) => x.paidMinor),
        ...approvedClaims.map((c) => c.paidMinor),
        ...bankExpenses.map((b) => b.amountMinor),
      ]),
      outstanding: sumMinor([
        ...list.map((x) => x.outstandingMinor),
        ...approvedClaims.map((c) => c.claimedMinor - c.paidMinor),
      ]),
      overdue: sumMinor(list.filter((x) => x.isOverdue).map((x) => x.outstandingMinor)),
    };
  });
  return {
    company,
    salaries: ['Admin', 'Finance'].includes(actor.role)
      ? await db
          .select()
          .from(s.salarySlips)
          .where(eq(s.salarySlips.companyId, actor.companyId))
          .orderBy(desc(s.salarySlips.month))
      : [],
    actor,
    categories,
    currencies,
    summaries,
    documents: docs.map(({ storageKey, ...d }) => d),
    invoices: invoiceRows,
    claims: claimRows,
    allocations: full ? allocations : [],
    bank: bankRows,
    accounts,
    statements: statements.map((x) => ({
      ...x,
      validation: validateStatement(bankDraftSchema.parse(x.draft), x.month),
    })),
    members: full ? members : members.filter((x) => x.id === actor.userId),
    audit: auditRows,
    jobs: jobRows,
    extractions: extracted,
    obligations,
    suggestions,
    groups,
    provider: process.env.AI_PROVIDER === 'openai' ? 'OpenAI' : 'Manual review · AI not configured',
    extractionModel:
      process.env.AI_PROVIDER === 'openai' ? process.env.OPENAI_MODEL || 'gpt-5.6-luna' : null,
    local: process.env.DATABASE_MODE === 'local' || !process.env.DATABASE_URL,
  };
}
export async function rejectSuggestion(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const d = z
    .object({ bankId: z.uuid(), targetId: z.uuid(), reason: z.string().trim().min(3).max(1000) })
    .parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [bank] = await tx
      .select()
      .from(s.bankTransactions)
      .where(
        and(eq(s.bankTransactions.companyId, actor.companyId), eq(s.bankTransactions.id, d.bankId)),
      );
    const [invoice] = await tx
      .select()
      .from(s.invoices)
      .where(and(eq(s.invoices.companyId, actor.companyId), eq(s.invoices.id, d.targetId)));
    const [claim] = await tx
      .select()
      .from(s.claims)
      .where(and(eq(s.claims.companyId, actor.companyId), eq(s.claims.id, d.targetId)));
    assert(bank && (invoice || claim), 'Match records not found.', 404);
    await tx
      .insert(s.reconciliationDecisions)
      .values({
        companyId: actor.companyId,
        bankId: d.bankId,
        targetId: d.targetId,
        actorId: actor.userId,
        reason: d.reason,
      })
      .onConflictDoNothing();
    await audit(
      tx,
      actor,
      `${d.bankId}:${d.targetId}`,
      'reconciliation.rejected',
      null,
      d,
      d.reason,
    );
    return { ok: true };
  });
}
