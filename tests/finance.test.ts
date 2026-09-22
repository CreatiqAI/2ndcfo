import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { getDb } from '../src/server/db';
import * as s from '../src/server/db/schema';
import { authenticate, actorFor, checkOrigin, sessionUser } from '../src/server/auth';
import { type Actor, minor, paymentStatus, sumMinor } from '../src/server/core';
import { snapshot } from '../src/server/workspace';
import { addEmployee } from '../src/server/employees';
import {
  createClaimLink,
  redeemClaimLink,
  claimLinkContext,
  claimPortalState,
} from '../src/server/claim-links';
import { trashRecord } from '../src/server/record-trash';
import { myrRate } from '../src/server/fx';
import { createSalary, getSalary, salaryAmounts } from '../src/server/salary';
import { salaryPdf, type SalaryDetails } from '../src/server/salary-pdf';
import {
  changePayslipTemplate,
  preparePayslipTemplate,
  templateSample,
} from '../src/server/payslip-template';
import sharp from 'sharp';
import { createClaim, changeClaim } from '../src/server/claims/service';
import { cancelInvoice, reviewInvoice } from '../src/server/invoices/service';
import { uploadDocument } from '../src/server/ingestion/service';
import { readOriginal } from '../src/server/ingestion/storage';
import { processOne } from '../src/server/extraction/worker';
import {
  createBankAccount,
  uploadStatement,
  confirmStatement,
  reviewImportedStatement,
} from '../src/server/banking/service';
import { parseStructured, validateStatement } from '../src/server/banking/parser';
import { confirmAllocations, categoriseBank } from '../src/server/reconciliation/service';
import { scoreMatch, suggestGroups } from '../src/server/reconciliation/engine';
let admin: Actor, other: Actor, employee: Actor, manager: Actor, accountId: string;
const month = '2026-09';
async function makeUser(
  email: string,
  role = 'Admin',
  department: string | null = null,
  companyId?: string,
) {
  const token = await authenticate(
    {
      email,
      password: 'a-very-long-test-password',
      name: role + ' tester',
      company: 'Test workspace',
    },
    true,
  );
  const user = await sessionUser(token),
    db = await getDb();
  if (companyId)
    await db.insert(s.memberships).values({ userId: user.id, companyId, role, department });
  const [member] = await db
    .select()
    .from(s.memberships)
    .where(
      and(
        eq(s.memberships.userId, user.id),
        ...(companyId ? [eq(s.memberships.companyId, companyId)] : []),
      ),
    );
  return actorFor(user.id, member.companyId);
}
async function draftInvoice(actor = admin, total = 100000, claimId?: string) {
  const db = await getDb(),
    [doc] = await db
      .insert(s.documents)
      .values({
        companyId: actor.companyId,
        uploaderId: actor.userId,
        claimId,
        batchId: randomUUID(),
        name: 'fixture.pdf',
        storageKey: `${actor.companyId}/${randomUUID()}`,
        mime: 'application/pdf',
        size: 12,
        hash: randomUUID(),
        purpose: claimId ? 'claim' : 'invoice',
      })
      .returning();
  const [invoice] = await db
    .insert(s.invoices)
    .values({
      companyId: actor.companyId,
      documentId: doc.id,
      claimId,
      kind: claimId ? 'Claim Receipt' : 'Supplier Invoice',
      party: 'Fixture Supplier',
      number: randomUUID(),
      invoiceDate: '2026-09-01',
      dueDate: '2026-09-10',
      totalMinor: total,
      currency: 'MYR',
      category: 'Software',
    })
    .returning();
  return invoice;
}
async function approvedInvoice(actor = admin, total = 100000) {
  const row = await draftInvoice(actor, total);
  return reviewInvoice(actor, { id: row.id, version: 1, action: 'approve' });
}
async function bank(amount = 100000, direction = 'out', currency = 'MYR') {
  const db = await getDb(),
    [doc] = await db
      .insert(s.documents)
      .values({
        companyId: admin.companyId,
        uploaderId: admin.userId,
        batchId: randomUUID(),
        name: 'test.csv',
        storageKey: `${admin.companyId}/${randomUUID()}`,
        mime: 'text/csv',
        size: 10,
        hash: randomUUID(),
        purpose: 'statement',
      })
      .returning();
  const [stmt] = await db
    .insert(s.statements)
    .values({
      companyId: admin.companyId,
      accountId,
      documentId: doc.id,
      month,
      status: 'Imported',
      draft: { opening: null, closing: null, rows: [], notes: 'Test fixture' },
    })
    .returning();
  const [row] = await db
    .insert(s.bankTransactions)
    .values({
      companyId: admin.companyId,
      accountId,
      statementId: stmt.id,
      rowIndex: 1,
      date: '2026-09-04',
      description: 'Fixture Supplier',
      direction,
      amountMinor: amount,
      currency,
      fingerprint: randomUUID(),
    })
    .returning();
  return row;
}
const allocate = (
  bankId: string,
  targetId: string,
  amountMinor: number,
  targetType = 'invoice',
) => ({ items: [{ bankId, targetId, amountMinor, targetType }], reason: 'Verified test evidence' });
beforeAll(async () => {
  process.env.DATABASE_MODE = 'local';
  process.env.LOCAL_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), '2ndcfo-test-'));
  process.env.AI_PROVIDER = 'mock';
  process.env.FX_PROVIDER = 'disabled';
  admin = await makeUser('admin@test.invalid');
  other = await makeUser('other@test.invalid');
  employee = await makeUser('employee@test.invalid', 'Employee', 'Operations', admin.companyId);
  manager = await makeUser('manager@test.invalid', 'Manager', 'Operations', admin.companyId);
  accountId = (await createBankAccount(admin, { name: 'Test bank', currency: 'MYR' })).id;
});
describe('Exact financial arithmetic and parser safety', () => {
  it('parses decimal strings exactly and rejects rounding/unsafe values', () => {
    expect(minor('1058.50')).toBe(105850);
    expect(minor('0.29')).toBe(29);
    expect(() => minor('1.999')).toThrow();
    expect(() => minor('1e9')).toThrow();
    expect(() => minor('9007199254740992')).toThrow();
  });
  it('distinguishes invoice amounts from cash status', () => {
    expect(paymentStatus(1000000, 400000, '2026-01-01')).toBe('Partially Paid');
    expect(paymentStatus(1000000, 0, '2026-01-01')).toBe('Overdue');
    expect(paymentStatus(1000000, 1000000, null)).toBe('Paid');
  });
  it('detects aggregate overflow rather than losing cents', () => {
    expect(sumMinor([29, 71])).toBe(100);
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow('precision');
  });
  it('suggests combined instalments using identity and exact aggregate amounts', () => {
    const t = {
      id: 'i',
      type: 'invoice' as const,
      party: 'Vendor',
      number: 'INV-123',
      reference: '',
      description: '',
      date: '2026-09-01',
      currency: 'MYR',
      direction: 'out' as const,
      outstanding: 1000000,
    };
    const banks = [400000, 300000, 300000].map((v, i) => ({
      id: String(i),
      date: '2026-09-01',
      description: 'Vendor INV-123',
      reference: '',
      currency: 'MYR',
      direction: 'out',
      remaining: v,
    }));
    expect(suggestGroups([t], banks)[0].items.map((x) => x.amountMinor)).toEqual([
      400000, 300000, 300000,
    ]);
  });
  it('never suggests amount-only matches or cross-currency payments', () => {
    const t = {
      id: 'i',
      type: 'invoice' as const,
      party: 'Vendor',
      number: 'INV-123',
      reference: '',
      description: '',
      date: '2026-09-01',
      currency: 'MYR',
      direction: 'out' as const,
      outstanding: 10000,
    };
    const b = {
      id: 'b',
      date: '2026-09-01',
      description: 'Unrelated',
      reference: '',
      currency: 'MYR',
      direction: 'out',
      remaining: 10000,
    };
    expect(scoreMatch(t, b)).toBeNull();
    expect(scoreMatch(t, { ...b, description: 'Vendor INV-123' })?.confidence).toBeGreaterThan(80);
    expect(scoreMatch(t, { ...b, currency: 'USD', description: 'Vendor' })).toBeNull();
  });
  it('rejects ambiguous dates, dual signs, out-of-period and balance mismatch', () => {
    const draft = {
      opening: '100.00',
      closing: '100.00',
      notes: '',
      rows: [
        {
          date: '09/02/2026',
          description: 'x',
          reference: '',
          moneyIn: '10',
          moneyOut: '10',
          balance: null,
        },
        {
          date: '2026-10-01',
          description: 'x',
          reference: '',
          moneyIn: '10',
          moneyOut: '0',
          balance: null,
        },
        {
          date: '2026-09-03',
          description: 'x',
          reference: '',
          moneyIn: '10',
          moneyOut: '0',
          balance: '200',
        },
      ],
    };
    expect(validateStatement(draft, month).errors.length).toBeGreaterThanOrEqual(3);
  });
  it('parses CSV with exact cents and no inferred signs', async () => {
    const draft = await parseStructured(
      Buffer.from(
        'date,description,reference,money_in,money_out,balance\n2026-09-01,Fee,F1,0,0.29,99.71',
      ),
      'text/csv',
    );
    expect(validateStatement({ ...draft, opening: '100' }, month).rows[0].amountMinor).toBe(29);
  });
  it('parses XLSX values and rejects formulas', async () => {
    const workbook = new ExcelJS.Workbook(),
      sheet = workbook.addWorksheet('Transactions');
    sheet.addRow(['date', 'description', 'money_in', 'money_out']);
    sheet.addRow(['2026-09-01', 'Fee', 0, 12.34]);
    const data = Buffer.from(await workbook.xlsx.writeBuffer());
    const draft = await parseStructured(data, 'xlsx');
    expect(validateStatement(draft, month).rows[0].amountMinor).toBe(1234);
    sheet.getCell('D2').value = { formula: '1+1', result: 2 };
    await expect(
      parseStructured(Buffer.from(await workbook.xlsx.writeBuffer()), 'xlsx'),
    ).rejects.toThrow('Formula');
  });
});
describe('Identity, approval and tenant isolation', () => {
  it('validates logos, scopes template updates and snapshots the design into new payslips', async () => {
    await expect(changePayslipTemplate(employee, {})).rejects.toThrow('role');
    await expect(preparePayslipTemplate({ logo: 'https://example.com/logo.png' })).rejects.toThrow(
      'PNG',
    );
    await expect(
      preparePayslipTemplate({ logo: 'data:image/png;base64,bm90YW5pbWFnZQ==' }),
    ).rejects.toThrow('could not');
    const jpeg = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#109fea' },
    })
      .jpeg()
      .toBuffer();
    const template = await preparePayslipTemplate({
      title: 'Monthly Payslip',
      accent: '#109fea',
      logo: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      showSignature: false,
    });
    const metadata = await sharp(Buffer.from(template.logo.split(',')[1], 'base64')).metadata();
    expect([metadata.format, metadata.width, metadata.height]).toEqual(['png', 256, 128]);
    const db = await getDb();
    const before = (
      await db.select().from(s.companies).where(eq(s.companies.id, admin.companyId))
    )[0].payslipTemplate;
    const preview = await changePayslipTemplate(admin, template, true);
    expect('pdf' in preview).toBe(true);
    expect(
      (await db.select().from(s.companies).where(eq(s.companies.id, admin.companyId)))[0]
        .payslipTemplate,
    ).toEqual(before);
    await changePayslipTemplate(admin, template);
    expect(
      (await db.select().from(s.companies).where(eq(s.companies.id, other.companyId)))[0]
        .payslipTemplate,
    ).toEqual({});
    const created = await createSalary(admin, {
      employeeId: employee.userId,
      month: '2026-08',
      basic: '100',
    });
    await changePayslipTemplate(admin, { title: 'Changed' });
    const saved = (await getSalary(admin, created.id)).details as SalaryDetails;
    expect(saved.template?.title).toBe('Monthly Payslip');
    expect(saved.template?.logo).toBe(template.logo);
    const newPdf = await PDFDocument.load(await salaryPdf(saved));
    expect(newPdf.getPageCount()).toBe(1);
    expect(newPdf.getPage(0).getWidth()).toBeGreaterThan(newPdf.getPage(0).getHeight());
    const oldPdf = await PDFDocument.load(await salaryPdf(templateSample(undefined)));
    expect(oldPdf.getPage(0).getHeight()).toBeGreaterThan(oldPdf.getPage(0).getWidth());
    expect(
      (await PDFDocument.load(await salaryPdf(templateSample(undefined)))).getPageCount(),
    ).toBe(1);
    await changePayslipTemplate(admin, {});
  });
  it('calculates salary cents, protects payroll access and generates a single-page payslip', async () => {
    expect(salaryAmounts(['2800', '120', '90', '70', '250'], '100').netMinor).toBe(323000);
    expect(() => salaryAmounts(['10'], '11')).toThrow('exceed');
    expect(() => salaryAmounts(['-1'], '0')).toThrow('negative');
    const input = {
      employeeId: employee.userId,
      month,
      basic: '2800',
      attendance: '120',
      transport: '90',
      meal: '70',
      bonus: '250',
      deductions: '100',
    };
    await expect(createSalary(employee, input)).rejects.toThrow('role');
    await expect(createSalary(other, input)).rejects.toThrow('workspace');
    const result = await createSalary(admin, input);
    const record = await getSalary(admin, result.id);
    expect(record.grossMinor).toBe(333000);
    expect(record.netMinor).toBe(323000);
    const pdf = await PDFDocument.load(await salaryPdf(record.details as SalaryDetails));
    expect(pdf.getPageCount()).toBe(1);
    const unicodePdf = await PDFDocument.load(
      await salaryPdf({ ...(record.details as SalaryDetails), employeeName: '陈美玲' }),
    );
    expect(unicodePdf.getPageCount()).toBe(1);
    await expect(getSalary(employee, result.id)).rejects.toThrow('role');
    await expect(getSalary(other, result.id)).rejects.toThrow('not found');
    expect((await snapshot(employee)).salaries).toEqual([]);
    await expect(createSalary(admin, input)).rejects.toThrow('already exists');
  });
  it('shows missing currency as MYR and persists the default on approval', async () => {
    const row = await draftInvoice();
    await (
      await getDb()
    )
      .update(s.invoices)
      .set({ currency: null })
      .where(eq(s.invoices.id, row.id));
    const display = (await snapshot(admin)).invoices.find((i) => i.id === row.id)!;
    expect(display.currency).toBe('MYR');
    expect(display.myrTotalMinor).toBe(row.totalMinor);
    const approved = await reviewInvoice(admin, {
      id: row.id,
      version: row.version,
      action: 'approve',
    });
    expect(approved.currency).toBe('MYR');
  });
  it('fetches and retains dated MYR reference rates without changing foreign amounts', async () => {
    const mock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ base: 'USD', quote: 'MYR', date: '2026-07-28', rate: 4.25 }),
          { status: 200 },
        ),
      );
    delete process.env.FX_PROVIDER;
    try {
      const rate = await myrRate('USD', '2026-07-28');
      expect(rate?.rate).toBe('4.25');
      await myrRate('USD', '2026-07-28');
      expect(mock).toHaveBeenCalledTimes(1);
      const row = await draftInvoice();
      await (
        await getDb()
      )
        .update(s.invoices)
        .set({ currency: 'USD', invoiceDate: '2026-07-28' })
        .where(eq(s.invoices.id, row.id));
      process.env.FX_PROVIDER = 'disabled';
      const display = (await snapshot(admin)).invoices.find((i) => i.id === row.id)!;
      expect(display.totalMinor).toBe(row.totalMinor);
      expect(display.currency).toBe('USD');
      expect(display.myrTotalMinor).toBe(row.totalMinor! * 4.25);
    } finally {
      mock.mockRestore();
      process.env.FX_PROVIDER = 'disabled';
    }
  });
  it('redeems a claim link only once and limits its session to one employee claim', async () => {
    await expect(createClaimLink(employee, {})).rejects.toThrow('role');
    const link = await createClaimLink(admin, {
      employeeId: employee.userId,
      title: 'Portal expenses',
      month,
      currency: 'MYR',
    });
    const attempts = await Promise.allSettled([
      redeemClaimLink(link.token),
      redeemClaimLink(link.token),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    const session = (
      attempts.find((a) => a.status === 'fulfilled') as PromiseFulfilledResult<string>
    ).value;
    const context = await claimLinkContext(session);
    expect(context.claim.id).toBe(link.claimId);
    expect(context.actor.userId).toBe(employee.userId);
    await expect(sessionUser(session)).rejects.toThrow('Session');
    const own = await draftInvoice(admin, 4500, link.claimId);
    const state = await claimPortalState(session);
    expect(state.receipts.map((r) => r.id)).toEqual([own.id]);
    expect(JSON.stringify(state)).not.toContain('passwordHash');
    await trashRecord(admin, {
      id: link.claimId,
      type: 'claim',
      deleted: true,
      reason: 'Test deleted claim',
    });
    await expect(claimLinkContext(session)).rejects.toThrow('deleted');
    await trashRecord(admin, {
      id: link.claimId,
      type: 'claim',
      deleted: false,
      reason: 'Test restore',
    });
    await (
      await getDb()
    )
      .update(s.claimLinks)
      .set({ sessionExpiresAt: new Date(0) })
      .where(eq(s.claimLinks.claimId, link.claimId));
    await expect(claimLinkContext(session)).rejects.toThrow('expired');
    const expired = await createClaimLink(admin, {
      employeeId: employee.userId,
      title: 'Expired link',
      month,
      currency: 'MYR',
    });
    await (
      await getDb()
    )
      .update(s.claimLinks)
      .set({ expiresAt: new Date(0) })
      .where(eq(s.claimLinks.claimId, expired.claimId));
    await expect(redeemClaimLink(expired.token)).rejects.toThrow('expired');
  });
  it('trashes and restores approved records without erasing evidence or posted totals', async () => {
    const invoice = await approvedInvoice();
    const before = await snapshot(admin);
    const input = {
      id: invoice.id,
      type: 'invoice',
      deleted: true,
      reason: 'Remove from active list',
    };
    await expect(trashRecord(employee, input)).rejects.toThrow('role');
    await expect(trashRecord(other, input)).rejects.toThrow('not found');
    await trashRecord(admin, input);
    const after = await snapshot(admin);
    expect(after.invoices.find((i) => i.id === invoice.id)?.deleted).toBe(true);
    expect(after.summaries).toEqual(before.summaries);
    expect(after.documents.some((d) => d.id === invoice.documentId)).toBe(true);
    await trashRecord(admin, { ...input, deleted: false });
    expect((await snapshot(admin)).invoices.find((i) => i.id === invoice.id)?.deleted).toBe(false);
  });
  it('creates employee logins with scoped roles and never changes an existing password', async () => {
    await expect(
      addEmployee(employee, {
        name: 'New Person',
        email: 'newperson@test.invalid',
        password: 'abcdefgh',
        department: 'Operations',
      }),
    ).rejects.toThrow('role');
    const created = await addEmployee(admin, {
      name: 'New Person',
      email: 'newperson@test.invalid',
      password: 'abcdefgh',
      department: 'Operations',
    });
    const token = await authenticate(
      { email: 'newperson@test.invalid', password: 'abcdefgh' },
      false,
    );
    expect((await sessionUser(token)).id).toBe(created.id);
    expect((await actorFor(created.id, admin.companyId)).role).toBe('Employee');
    await expect(actorFor(created.id, other.companyId)).rejects.toThrow('access');
    await expect(
      addEmployee(admin, {
        name: 'New Person',
        email: 'newperson@test.invalid',
        password: 'newpassword',
        department: 'Other',
      }),
    ).rejects.toThrow('already');
  });
  it('totals receipt bundles once, freezes on approval and includes approved claims in Money Out', async () => {
    const c = await createClaim(admin, {
      title: 'Bundled expenses',
      month,
      claimed: '0',
      currency: 'MYR',
      employeeId: employee.userId,
      autoTotal: true,
    });
    await draftInvoice(admin, 1200, c.id);
    await draftInvoice(admin, 2300, c.id);
    const draft = await snapshot(admin);
    expect(draft.claims.find((x) => x.id === c.id)?.claimedMinor).toBe(3500);
    expect(draft.claims.find((x) => x.id === c.id)?.receiptCount).toBe(2);
    const totalBefore = draft.summaries.find((x) => x.kind === 'Supplier Invoice')!.total;
    await changeClaim(employee, { id: c.id, action: 'submit' });
    await changeClaim(manager, { id: c.id, action: 'manager' });
    await changeClaim(admin, { id: c.id, action: 'finance' });
    const approved = await snapshot(admin);
    expect(approved.claims.find((x) => x.id === c.id)?.claimedMinor).toBe(3500);
    expect(approved.summaries.find((x) => x.kind === 'Supplier Invoice')!.total).toBe(
      totalBefore + 3500,
    );
    expect(approved.obligations.filter((x) => x.id === c.id)).toHaveLength(1);
    expect((await snapshot(other)).claims.some((x) => x.id === c.id)).toBe(false);
  });
  it('uses payment terms for overdue status and totals without overwriting the approved due date', async () => {
    const i = await draftInvoice(admin, 176400);
    const db = await getDb();
    await db
      .update(s.invoices)
      .set({ invoiceDate: '2026-07-28', dueDate: null, paymentTerms: '14 days' })
      .where(eq(s.invoices.id, i.id));
    await reviewInvoice(admin, { id: i.id, version: i.version, action: 'approve' });
    const state = await snapshot(admin);
    const row = state.invoices.find((x) => x.id === i.id)!;
    expect(row.dueDate).toBeNull();
    expect(row.effectiveDueDate).toBe('2026-08-11');
    expect(row.dueDateSource).toBe('terms');
    expect(row.isOverdue).toBe(true);
    expect(row.paymentStatus).toBe('Overdue');
    expect(
      state.summaries.find((x) => x.kind === 'Supplier Invoice')!.overdue,
    ).toBeGreaterThanOrEqual(176400);
    expect(
      (await db.select().from(s.invoices).where(eq(s.invoices.id, i.id)))[0].dueDate,
    ).toBeNull();
  });
  it('explains overdue balances, including partial payments, and clears them on settlement', async () => {
    const invoice = await approvedInvoice(admin, 116400);
    const before = (await snapshot(admin)).invoices.find((i) => i.id === invoice.id)!;
    expect(before.isOverdue).toBe(true);
    expect(before.paymentStatus).toBe('Overdue');
    const payment = await bank(116400);
    await confirmAllocations(admin, allocate(payment.id, invoice.id, 40000));
    const partial = (await snapshot(admin)).invoices.find((i) => i.id === invoice.id)!;
    expect(partial.isOverdue).toBe(true);
    expect(partial.paymentStatus).toBe('Partially Paid');
    expect(partial.outstandingMinor).toBe(76400);
    await confirmAllocations(admin, allocate(payment.id, invoice.id, 76400));
    const paid = (await snapshot(admin)).invoices.find((i) => i.id === invoice.id)!;
    expect(paid.isOverdue).toBe(false);
    expect(paid.paymentStatus).toBe('Paid');
  });
  it('rejects cross-origin state mutations', () => {
    expect(() =>
      checkOrigin(
        new Request('http://localhost:3000/api/action', {
          headers: { origin: 'https://evil.example' },
        }),
      ),
    ).toThrow();
  });
  it('cannot select another company without membership', async () => {
    await expect(actorFor(employee.userId, other.companyId)).rejects.toThrow('access');
  });
  it('approval changes no cash and locks invoice evidence', async () => {
    const invoice = await approvedInvoice();
    const db = await getDb();
    expect(
      await db.select().from(s.allocations).where(eq(s.allocations.invoiceId, invoice.id)),
    ).toHaveLength(0);
    await expect(
      reviewInvoice(admin, { id: invoice.id, version: invoice.version, action: 'save' }),
    ).rejects.toThrow('Approved');
    await expect(
      db.update(s.invoices).set({ totalMinor: 1 }).where(eq(s.invoices.id, invoice.id)),
    ).rejects.toThrow();
  });
  it('cancels an unpaid invoice through separate immutable evidence', async () => {
    const i = await approvedInvoice();
    await cancelInvoice(admin, { id: i.id, reason: 'Invoice issued to the wrong customer' });
    const original = await (await getDb()).select().from(s.invoices).where(eq(s.invoices.id, i.id));
    expect(original[0].reviewStatus).toBe('Approved');
    expect((await snapshot(admin)).invoices.find((x) => x.id === i.id)?.paymentStatus).toBe(
      'Cancelled',
    );
    const b = await bank();
    await expect(confirmAllocations(admin, allocate(b.id, i.id, 100000))).rejects.toThrow(
      'cancelled',
    );
  });
  it('requires verified fields before approval and prevents stale edits', async () => {
    const i = await draftInvoice();
    await (await getDb()).update(s.invoices).set({ party: null }).where(eq(s.invoices.id, i.id));
    await expect(reviewInvoice(admin, { id: i.id, version: 1, action: 'approve' })).rejects.toThrow(
      'verified',
    );
    await expect(reviewInvoice(admin, { id: i.id, version: 2, action: 'save' })).rejects.toThrow(
      'changed',
    );
  });
  it('employees cannot approve financial invoices', async () => {
    const i = await draftInvoice();
    await expect(
      reviewInvoice(employee, { id: i.id, version: 1, action: 'approve' }),
    ).rejects.toThrow('role');
  });
  it('audit events cannot be rewritten or removed', async () => {
    await expect(
      (await getDb()).execute(sql`DELETE FROM audit_events WHERE company_id=${admin.companyId}`),
    ).rejects.toThrow();
  });
});
describe('Document pipeline and statement import', () => {
  it('retains malformed provider responses without fabricating financial candidates', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const doc = await uploadDocument(
      admin,
      { name: 'provider-error.pdf', data: Buffer.from(await pdf.save()) },
      { batchId: randomUUID() },
    );
    const raw = { output: [{ content: [{ type: 'output_text', text: 'not valid JSON' }] }] };
    const mock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-placeholder-never-sent';
    try {
      await processOne(admin.companyId);
    } finally {
      mock.mockRestore();
      process.env.AI_PROVIDER = 'mock';
      delete process.env.OPENAI_API_KEY;
    }
    const db = await getDb();
    const [job] = await db.select().from(s.jobs).where(eq(s.jobs.documentId, doc.id));
    expect(job.status).toBe('failed');
    const [extraction] = await db
      .select()
      .from(s.extractions)
      .where(eq(s.extractions.documentId, doc.id));
    expect(extraction.raw).toEqual(raw);
    expect(
      await db.select().from(s.invoices).where(eq(s.invoices.documentId, doc.id)),
    ).toHaveLength(0);
  });
  it('retains original PDF and yields unknown fields when AI is unconfigured', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    const doc = await uploadDocument(
      admin,
      { name: 'two-page.pdf', data: bytes },
      { batchId: randomUUID(), defaultPaymentTermDays: 14 },
    );
    await processOne(admin.companyId);
    const db = await getDb(),
      [record] = await db.select().from(s.documents).where(eq(s.documents.id, doc.id));
    expect(await readOriginal(record.storageKey)).toEqual(bytes);
    expect(record.defaultPaymentTermDays).toBe(14);
    const [i] = await db.select().from(s.invoices).where(eq(s.invoices.documentId, doc.id));
    expect(i.totalMinor).toBeNull();
    expect(i.reviewStatus).toBe('Needs Review');
    expect(i.pageEnd).toBe(2);
    expect(
      await db.select().from(s.extractions).where(eq(s.extractions.documentId, doc.id)),
    ).toHaveLength(1);
    await processOne(admin.companyId);
    expect(
      await db.select().from(s.invoices).where(eq(s.invoices.documentId, doc.id)),
    ).toHaveLength(1);
  });
  it('requires human statement import and prevents duplicate source imports', async () => {
    const bytes = Buffer.from(
      'date,description,reference,money_in,money_out,balance\n2026-09-12,Human import,IMP-001,0,7.77,992.23',
    );
    const stmt = await uploadStatement(
      admin,
      { name: 'statement.csv', data: bytes },
      { accountId, month },
    );
    const db = await getDb();
    expect(
      await db.select().from(s.bankTransactions).where(eq(s.bankTransactions.statementId, stmt.id)),
    ).toHaveLength(0);
    await confirmStatement(admin, { id: stmt.id, draft: stmt.draft, reason: 'Verified source' });
    const beforeRows = await db
      .select()
      .from(s.bankTransactions)
      .where(eq(s.bankTransactions.statementId, stmt.id));
    const beforeAllocations = await db.select().from(s.allocations);
    await expect(
      reviewImportedStatement(employee, { id: stmt.id, reason: 'Verified a second time' }),
    ).rejects.toThrow('role');
    await expect(
      reviewImportedStatement(other, { id: stmt.id, reason: 'Verified a second time' }),
    ).rejects.toThrow('not found');
    await reviewImportedStatement(admin, { id: stmt.id, reason: 'Verified a second time' });
    expect(
      await db.select().from(s.bankTransactions).where(eq(s.bankTransactions.statementId, stmt.id)),
    ).toEqual(beforeRows);
    expect(await db.select().from(s.allocations)).toEqual(beforeAllocations);
    const reviews = await db
      .select()
      .from(s.auditEvents)
      .where(
        and(eq(s.auditEvents.entityId, stmt.id), eq(s.auditEvents.action, 'statement.reviewed')),
      );
    expect(reviews).toHaveLength(1);
    expect(reviews[0].reason).toBe('Verified a second time');
    expect(
      await db.select().from(s.bankTransactions).where(eq(s.bankTransactions.statementId, stmt.id)),
    ).toHaveLength(1);
    await expect(
      confirmStatement(admin, { id: stmt.id, draft: stmt.draft, reason: 'Reimport' }),
    ).rejects.toThrow('finalised');
    await expect(
      uploadStatement(admin, { name: 'renamed.csv', data: bytes }, { accountId, month }),
    ).rejects.toThrow('already uploaded');
  });
});
describe('Claims lifecycle and access', () => {
  it('matches two equal incoming payments to separate invoices without reusing either payment', async () => {
    const db = await getDb();
    const first = await draftInvoice(admin, 44400),
      second = await draftInvoice(admin, 44400);
    for (const invoice of [first, second]) {
      await db
        .update(s.invoices)
        .set({ kind: 'Sales Invoice' })
        .where(eq(s.invoices.id, invoice.id));
      await reviewInvoice(admin, { id: invoice.id, version: 1, action: 'approve' });
    }
    const a = await bank(44400, 'in'),
      b = await bank(44400, 'in');
    const items = [
      { bankId: a.id, targetId: first.id, targetType: 'invoice', amountMinor: 44400 },
      { bankId: b.id, targetId: second.id, targetType: 'invoice', amountMinor: 44400 },
    ];
    await confirmAllocations(admin, {
      items,
      reason: 'Matched distinct references against invoices',
    });
    const result = await snapshot(admin);
    expect(result.invoices.find((i) => i.id === first.id)?.outstandingMinor).toBe(0);
    expect(result.invoices.find((i) => i.id === second.id)?.outstandingMinor).toBe(0);
    expect(result.bank.find((row) => row.id === a.id)?.remaining).toBe(0);
    expect(result.bank.find((row) => row.id === b.id)?.remaining).toBe(0);
    await expect(
      confirmAllocations(admin, { items, reason: 'Accidental repeat matching' }),
    ).rejects.toThrow('remaining');
  });
  it('calculates missing receipt difference without equating it to a missing record', async () => {
    const c = await createClaim(employee, {
      title: 'Travel',
      month,
      currency: 'MYR',
      claimed: '1100',
    });
    await draftInvoice(employee, 105850, c.id);
    const submitted = await changeClaim(employee, { id: c.id, action: 'submit' });
    expect(submitted.status).toBe('Needs Review');
    const view = await snapshot(employee),
      row = view.claims.find((x) => x.id === c.id)!;
    expect(row.difference).toBe(4150);
    expect(row.receiptTotal).toBe(105850);
    expect(view.invoices.every((x) => x.claimId)).toBe(true);
    expect(view.bank).toEqual([]);
    await expect(
      changeClaim(admin, { id: c.id, action: 'finance', reason: 'Exception approved' }),
    ).rejects.toThrow('Manager approval');
    await expect(changeClaim(manager, { id: c.id, action: 'manager' })).rejects.toThrow(
      'exception',
    );
    await changeClaim(manager, {
      id: c.id,
      action: 'manager',
      reason: 'Verified legitimate difference with employee',
    });
    const approved = await changeClaim(admin, {
      id: c.id,
      action: 'finance',
      reason: 'Verified exception and supporting receipt evidence',
    });
    expect(approved.status).toBe('Finance Approved');
    expect((await snapshot(employee)).claims.find((x) => x.id === c.id)?.paymentStatus).toBe(
      'Unpaid',
    );
    const b = await bank(110000);
    await confirmAllocations(admin, allocate(b.id, c.id, 110000, 'claim'));
    expect((await snapshot(employee)).claims.find((x) => x.id === c.id)?.paymentStatus).toBe(
      'Paid',
    );
  });
  it('blocks employee access to another employee’s claim evidence', async () => {
    const c = await createClaim(admin, {
      title: 'Private expense',
      month,
      currency: 'MYR',
      claimed: '10',
    });
    const i = await draftInvoice(admin, 1000, c.id);
    expect((await snapshot(employee)).claims.some((x) => x.id === c.id)).toBe(false);
    await expect(reviewInvoice(employee, { id: i.id, version: 1, action: 'save' })).rejects.toThrow(
      'own',
    );
  });
  it('blocks manager self-approval', async () => {
    const c = await createClaim(manager, {
      title: 'Manager travel',
      month,
      currency: 'MYR',
      claimed: '10',
    });
    await draftInvoice(manager, 1000, c.id);
    await changeClaim(manager, { id: c.id, action: 'submit' });
    await expect(
      changeClaim(manager, { id: c.id, action: 'manager', reason: 'I approved my own receipt' }),
    ).rejects.toThrow('Self-approval');
  });
});
describe('Reconciliation transaction invariants', () => {
  it('supports partial and combined payment settlement', async () => {
    const i = await approvedInvoice(admin, 1000000),
      b1 = await bank(400000),
      b2 = await bank(300000),
      b3 = await bank(300000);
    await confirmAllocations(admin, allocate(b1.id, i.id, 400000));
    expect((await snapshot(admin)).invoices.find((x) => x.id === i.id)?.paymentStatus).toBe(
      'Partially Paid',
    );
    await confirmAllocations(admin, {
      items: [...allocate(b2.id, i.id, 300000).items, ...allocate(b3.id, i.id, 300000).items],
      reason: 'Combined instalment receipts',
    });
    expect((await snapshot(admin)).invoices.find((x) => x.id === i.id)?.paymentStatus).toBe('Paid');
  });
  it('splits one bank payment across multiple invoices', async () => {
    const a = await approvedInvoice(admin, 300000),
      b = await approvedInvoice(admin, 400000),
      c = await approvedInvoice(admin, 300000),
      payment = await bank(1000000);
    await confirmAllocations(admin, {
      items: [
        ...allocate(payment.id, a.id, 300000).items,
        ...allocate(payment.id, b.id, 400000).items,
        ...allocate(payment.id, c.id, 300000).items,
      ],
      reason: 'One supplier payment covers three invoices',
    });
    expect((await snapshot(admin)).bank.find((x) => x.id === payment.id)?.remaining).toBe(0);
  });
  it('rejects wrong currency/direction and cross-tenant links', async () => {
    const i = await approvedInvoice(),
      wrongCurrency = await bank(100000, 'out', 'USD'),
      wrongDirection = await bank(100000, 'in'),
      foreign = await approvedInvoice(other),
      good = await bank();
    await expect(
      confirmAllocations(admin, allocate(wrongCurrency.id, i.id, 100000)),
    ).rejects.toThrow('currency');
    await expect(
      confirmAllocations(admin, allocate(wrongDirection.id, i.id, 100000)),
    ).rejects.toThrow('direction');
    await expect(confirmAllocations(admin, allocate(good.id, foreign.id, 100000))).rejects.toThrow(
      'approved invoice',
    );
  });
  it('serialises simultaneous confirmations and rolls back over-allocation', async () => {
    const i = await approvedInvoice(),
      b = await bank();
    const results = await Promise.allSettled([
      confirmAllocations(admin, allocate(b.id, i.id, 100000)),
      confirmAllocations(admin, allocate(b.id, i.id, 100000)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await (
      await getDb()
    )
      .select()
      .from(s.allocations)
      .where(eq(s.allocations.bankTransactionId, b.id));
    expect(rows.reduce((a, x) => a + x.amountMinor, 0)).toBe(100000);
  });
  it('does not double-count a directly categorised bank fee', async () => {
    const b = await bank(3500),
      i = await approvedInvoice(admin, 3500);
    await categoriseBank(admin, {
      id: b.id,
      category: 'Bank Charges',
      reason: 'Monthly fee with bank evidence',
    });
    await expect(confirmAllocations(admin, allocate(b.id, i.id, 3500))).rejects.toThrow(
      'categorised',
    );
  });
  it('blocks changes to closed periods', async () => {
    const i = await draftInvoice();
    await (
      await getDb()
    )
      .insert(s.closedPeriods)
      .values({ companyId: admin.companyId, month, closedBy: admin.userId });
    await expect(reviewInvoice(admin, { id: i.id, version: 1, action: 'approve' })).rejects.toThrow(
      'closed',
    );
  });
});
