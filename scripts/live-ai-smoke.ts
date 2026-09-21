import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// Explicit opt-in: this test sends three synthetic PDFs to the configured AI provider.
assert(
  process.env.RUN_LIVE_AI_TEST === '1',
  'Set RUN_LIVE_AI_TEST=1 to authorize paid live extraction.',
);
const origin = 'http://127.0.0.1:3000';
let cookie = '',
  companyId = '';
async function call(path: string, body?: unknown, expected = 200) {
  const r = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      Cookie: cookie,
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  assert.equal(r.status, expected, `Unexpected HTTP status on ${path}`);
  return r;
}
async function state() {
  return (await (await call('/api/state?company=' + companyId)).json()).state;
}
async function action(action: string, input: Record<string, unknown> = {}) {
  return (await call('/api/action', { companyId, action, ...input })).json();
}
async function pdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 790 - i * 25, size: 12, font }));
  return new Uint8Array(await doc.save());
}
async function upload(name: string, lines: string[], extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set('file', new Blob([await pdf(lines)], { type: 'application/pdf' }), name);
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return (await call('/api/upload?company=' + companyId, form)).json();
}
const signup = await call('/api/auth', {
  action: 'signup',
  email: `live-test-${randomUUID()}@example.invalid`,
  password: randomUUID() + randomUUID(),
  name: 'Live AI acceptance tester',
  company: 'Synthetic AI Test Company',
});
cookie = signup.headers.get('set-cookie')!.split(';')[0];
companyId = (await state()).company.id;
for (const [kind, party, number, total] of [
  ['Sales Invoice', 'Synthetic Customer', 'SALE-AI-001', '1000.00'],
  ['Supplier Invoice', 'Synthetic Software Vendor', 'BILL-AI-001', '250.00'],
]) {
  await upload(number + '.pdf', [
    'SYNTHETIC TEST DOCUMENT - NOT A REAL INVOICE',
    kind,
    'Workspace: Synthetic AI Test Company',
    kind === 'Sales Invoice' ? 'Issued by: Synthetic AI Test Company' : 'Issued by: ' + party,
    kind === 'Sales Invoice' ? 'Bill to: ' + party : 'Bill to: Synthetic AI Test Company',
    'Invoice number: ' + number,
    'Invoice date: 2026-09-01',
    'Due date: 2026-09-30',
    'Description: Software services',
    'Currency: MYR',
    'Subtotal: ' + total,
    'Tax: 0.00',
    'Total: ' + total,
  ]);
  await action('jobs.process');
  const current = await state();
  const invoice = current.invoices.find((i: any) => i.number === number);
  assert(
    invoice,
    'Live invoice extraction did not produce expected invoice: ' +
      JSON.stringify(current.jobs.map((j: any) => ({ status: j.status, error: j.error }))),
  );
  assert.equal(invoice.kind, kind);
  assert.equal(invoice.totalMinor, Number(total) * 100);
  assert.equal(invoice.currency, 'MYR');
  await action('invoice.review', {
    id: invoice.id,
    version: invoice.version,
    operation: 'approve',
    reason: 'Verified synthetic fixture against its original PDF',
    fields: {
      kind,
      party,
      number,
      invoiceDate: '2026-09-01',
      dueDate: '2026-09-30',
      description: 'Software services',
      product: null,
      paymentTerms: null,
      bankReference: number,
      subtotal: total,
      tax: '0.00',
      total,
      currency: 'MYR',
      category: 'Software',
    },
  });
  console.log(kind + ': live PDF extraction and approval passed');
}
const account = await action('account.create', { name: 'Synthetic test bank', currency: 'MYR' });
const statement = await upload(
  'synthetic-bank.pdf',
  [
    'SYNTHETIC BANK STATEMENT - NOT A REAL BANK ACCOUNT',
    'Account: Synthetic AI Test Company',
    'Currency: MYR',
    'Statement period: 2026-09-01 to 2026-09-30',
    'Opening balance: 2000.00',
    'Date | Description | Reference | Money in | Money out | Balance',
    '2026-09-02 | Synthetic Customer | SALE-AI-001 | 1000.00 | 0.00 | 3000.00',
    '2026-09-03 | Synthetic Software Vendor | BILL-AI-001 | 0.00 | 250.00 | 2750.00',
    'Closing balance: 2750.00',
  ],
  { purpose: 'statement', accountId: account.id, month: '2026-09' },
);
assert.equal(statement.draft.rows.length, 2, 'Bank PDF extraction must return both rows');
assert.equal(Number(statement.draft.opening), 2000);
assert.equal(Number(statement.draft.closing), 2750);
assert.equal(Number(statement.draft.rows[0].moneyIn), 1000);
assert.equal(Number(statement.draft.rows[1].moneyOut), 250);
await action('statement.confirm', {
  id: statement.id,
  draft: statement.draft,
  reason: 'Verified synthetic statement rows and balances',
});
let current = await state();
for (const invoice of current.invoices) {
  const bank = current.bank.find((b: any) => b.reference === invoice.number);
  assert(bank, 'Matching reference must survive statement import');
  await action('allocation.confirm', {
    items: [
      {
        bankId: bank.id,
        targetType: 'invoice',
        targetId: invoice.id,
        amountMinor: invoice.totalMinor,
      },
    ],
    reason: 'Verified synthetic payment against original statement',
  });
}
current = await state();
assert(current.invoices.every((i: any) => i.paymentStatus === 'Paid' && i.outstandingMinor === 0));
assert(current.bank.every((b: any) => b.status === 'Matched'));
console.log('Bank PDF extraction, reviewed import, money in and money out matching: passed');
await call('/api/auth', { action: 'logout' });
console.log(JSON.stringify({ result: 'passed', testWorkspace: companyId, liveDocuments: 3 }));
