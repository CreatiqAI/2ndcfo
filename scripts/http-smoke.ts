import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const batchSize = Number(process.env.SMOKE_BATCH_SIZE || 50);
assert(origin.startsWith('http://127.0.0.1:'), 'Smoke tests must target the local preview.');
let cookie = '',
  companyId = '';
async function call(path: string, body?: unknown, expected = 200, customCookie = cookie) {
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      ...(customCookie ? { Cookie: customCookie } : {}),
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  assert.equal(response.status, expected, `${path}: ${await response.clone().text()}`);
  return response;
}
async function action(action: string, input: Record<string, unknown> = {}) {
  return (await call('/api/action', { companyId, action, ...input })).json();
}
const email = `http-test-${randomUUID()}@example.invalid`;
const signup = await call('/api/auth', {
  action: 'signup',
  email,
  password: 'local-test-only-long-password',
  name: 'HTTP acceptance tester',
  company: 'HTTP acceptance test — isolated',
});
const header = signup.headers.get('set-cookie')!;
assert(header.includes('HttpOnly') && header.includes('SameSite=lax'));
cookie = header.split(';')[0];
companyId = (await (await call('/api/state')).json()).state.company.id;
const csrf = await fetch(origin + '/api/action', {
  method: 'POST',
  headers: {
    Origin: 'https://attacker.invalid',
    Cookie: cookie,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ companyId, action: 'claim.create' }),
});
assert.equal(csrf.status, 403);
const pdf = await PDFDocument.create();
pdf.addPage();
const bytes = await pdf.save(),
  batchId = randomUUID();
const uploaded: string[] = [];
for (let i = 0; i < batchSize; i++) {
  const form = new FormData();
  form.set(
    'file',
    new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    `acceptance-${i + 1}.pdf`,
  );
  form.set('batchId', batchId);
  const result = await (await call('/api/upload?company=' + companyId, form)).json();
  uploaded.push(result.id);
}
for (let i = 0; i < batchSize; i++) await action('jobs.process');
let state = (await (await call('/api/state?company=' + companyId)).json()).state;
assert.equal(state.documents.length, batchSize);
assert.equal(state.invoices.length, batchSize);
assert(
  state.invoices.every(
    (i: { totalMinor: null; reviewStatus: string }) =>
      i.totalMinor === null && i.reviewStatus === 'Needs Review',
  ),
);
assert(state.jobs.every((j: { status: string }) => j.status === 'complete'));
const first = state.invoices[0];
await action('invoice.review', {
  id: first.id,
  version: first.version,
  operation: 'approve',
  reason: 'Known test fixture manually reviewed',
  fields: {
    kind: 'Supplier Invoice',
    party: 'Acceptance Vendor',
    number: 'TEST-001',
    invoiceDate: '2026-09-01',
    dueDate: '2026-09-30',
    description: 'Test only',
    product: null,
    paymentTerms: null,
    bankReference: 'TEST-001',
    subtotal: '1000.00',
    tax: '0.00',
    total: '1000.00',
    currency: 'MYR',
    category: 'Software',
  },
});
const account = await action('account.create', { name: 'Acceptance bank', currency: 'MYR' });
const form = new FormData();
form.set('purpose', 'statement');
form.set('accountId', account.id);
form.set('month', '2026-09');
form.set(
  'file',
  new Blob(
    [
      'date,description,reference,money_in,money_out,balance\n2026-09-02,Acceptance Vendor,TEST-001,0,400.00,600.00',
    ],
    { type: 'text/csv' },
  ),
  'acceptance-bank.csv',
);
const statement = await (await call('/api/upload?company=' + companyId, form)).json();
await action('statement.confirm', {
  id: statement.id,
  draft: { ...statement.draft, opening: '1000.00', closing: '600.00' },
  reason: 'Reviewed original fixture statement',
});
state = (await (await call('/api/state?company=' + companyId)).json()).state;
await action('allocation.confirm', {
  items: [
    { bankId: state.bank[0].id, targetType: 'invoice', targetId: first.id, amountMinor: 40000 },
  ],
  reason: 'Verified partial payment fixture',
});
state = (await (await call('/api/state?company=' + companyId)).json()).state;
assert.equal(state.invoices.find((i: { id: string }) => i.id === first.id).outstandingMinor, 60000);
assert.equal(
  state.invoices.find((i: { id: string }) => i.id === first.id).paymentStatus,
  'Partially Paid',
);
await call(
  '/api/action',
  {
    companyId,
    action: 'allocation.confirm',
    items: [
      { bankId: state.bank[0].id, targetType: 'invoice', targetId: first.id, amountMinor: 40000 },
    ],
    reason: 'Attempt repeat allocation',
  },
  409,
);
const download = await call(`/api/documents/${uploaded[0]}?company=${companyId}`);
assert.equal(download.headers.get('content-type'), 'application/pdf');
assert.equal((await download.arrayBuffer()).byteLength, bytes.length);
const exportFile = await call('/api/export?company=' + companyId + '&kind=transactions');
assert((await exportFile.text()).includes('TEST-001'));
await call('/api/documents/' + uploaded[0] + '?company=' + companyId, undefined, 401, '');
const otherSignup = await call('/api/auth', {
  action: 'signup',
  email: `other-${randomUUID()}@example.invalid`,
  password: 'another-local-test-password',
  name: 'Other tester',
  company: 'Other HTTP test workspace',
});
const otherCookie = otherSignup.headers.get('set-cookie')!.split(';')[0];
await call('/api/state?company=' + companyId, undefined, 403, otherCookie);
await call('/api/auth', { action: 'logout' });
await call('/api/state', undefined, 401);
console.log(
  JSON.stringify(
    {
      result: 'passed',
      batchFiles: batchSize,
      checks: [
        'signup/session cookie',
        'CSRF',
        'batch persistence and extraction',
        'manual invoice approval',
        'bank CSV import',
        'partial settlement',
        'over-allocation blocked',
        'original download',
        'CSV export',
        'tenant isolation',
        'logout',
      ],
      testWorkspace: companyId,
    },
    null,
    2,
  ),
);
