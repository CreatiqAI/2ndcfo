import {
  pgTable,
  text,
  uuid,
  timestamp,
  date,
  integer,
  bigint,
  jsonb,
  unique,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
const id = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: 'number' });
export const claimLinks = pgTable('claim_links', {
  id: id(),
  companyId: uuid('company_id').notNull(),
  claimId: uuid('claim_id').notNull(),
  createdBy: uuid('created_by').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  sessionHash: text('session_hash').unique(),
  sessionExpiresAt: timestamp('session_expires_at', { withTimezone: true }),
});
export const recordTrash = pgTable('record_trash', {
  id: id(),
  companyId: uuid('company_id').notNull(),
  invoiceId: uuid('invoice_id').unique(),
  claimId: uuid('claim_id').unique(),
  deleted: boolean('deleted').notNull().default(true),
});
export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  googleSubject: text('google_subject').unique(),
  createdAt: created(),
});
export const companies = pgTable('companies', {
  id: id(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('MYR'),
  timezone: text('timezone').notNull().default('Asia/Kuala_Lumpur'),
  createdAt: created(),
});
export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    department: text('department'),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.userId)],
);
export const sessions = pgTable('sessions', {
  id: id(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
});
export const authAttempts = pgTable('auth_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});
export const claims = pgTable(
  'claims',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    department: text('department'),
    month: text('month').notNull(),
    currency: text('currency').notNull(),
    claimedMinor: money('claimed_minor').notNull(),
    autoTotal: boolean('auto_total').notNull().default(false),
    status: text('status').notNull().default('Draft'),
    managerId: uuid('manager_id').references(() => users.id),
    financeId: uuid('finance_id').references(() => users.id),
    exceptionReason: text('exception_reason'),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.id)],
);
export const documents = pgTable(
  'documents',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id),
    claimId: uuid('claim_id').references(() => claims.id),
    batchId: uuid('batch_id').notNull(),
    name: text('name').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    hash: text('hash').notNull(),
    imageHash: text('image_hash'),
    purpose: text('purpose').notNull(),
    defaultPaymentTermDays: integer('default_payment_term_days'),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.id), index().on(t.companyId, t.hash)],
);
export const jobs = pgTable('extraction_jobs', {
  id: id(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  documentId: uuid('document_id')
    .notNull()
    .unique()
    .references(() => documents.id),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  leaseUntil: timestamp('lease_until', { withTimezone: true }),
  error: text('error'),
  createdAt: created(),
});
export const extractions = pgTable('extractions', {
  id: id(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id),
  provider: text('provider').notNull(),
  model: text('model'),
  raw: jsonb('raw').notNull(),
  createdAt: created(),
});
export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    claimId: uuid('claim_id').references(() => claims.id),
    pageStart: integer('page_start').notNull().default(1),
    pageEnd: integer('page_end').notNull().default(1),
    kind: text('kind').notNull(),
    party: text('party'),
    number: text('number'),
    invoiceDate: date('invoice_date'),
    dueDate: date('due_date'),
    description: text('description'),
    product: text('product'),
    paymentTerms: text('payment_terms'),
    bankReference: text('bank_reference'),
    subtotalMinor: money('subtotal_minor'),
    taxMinor: money('tax_minor'),
    totalMinor: money('total_minor'),
    currency: text('currency'),
    category: text('category'),
    confidence: integer('confidence').notNull().default(0),
    reviewStatus: text('review_status').notNull().default('Needs Review'),
    lifecycle: text('lifecycle').notNull().default('Draft'),
    duplicateOf: uuid('duplicate_of'),
    duplicateReason: text('duplicate_reason'),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.id), index().on(t.companyId, t.reviewStatus)],
);
export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    currency: text('currency').notNull(),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.id)],
);
export const statements = pgTable(
  'statements',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => bankAccounts.id),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    month: text('month').notNull(),
    openingMinor: money('opening_minor'),
    closingMinor: money('closing_minor'),
    status: text('status').notNull().default('Needs Review'),
    draft: jsonb('draft').notNull(),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.id)],
);
export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => bankAccounts.id),
    statementId: uuid('statement_id')
      .notNull()
      .references(() => statements.id),
    rowIndex: integer('row_index').notNull(),
    date: date('date').notNull(),
    description: text('description').notNull(),
    reference: text('reference'),
    direction: text('direction').notNull(),
    amountMinor: money('amount_minor').notNull(),
    balanceMinor: money('balance_minor'),
    currency: text('currency').notNull(),
    fingerprint: text('fingerprint').notNull(),
    category: text('category'),
    createdAt: created(),
  },
  (t) => [
    unique().on(t.companyId, t.id),
    unique().on(t.statementId, t.rowIndex),
    index().on(t.companyId, t.fingerprint),
  ],
);
export const allocations = pgTable('allocations', {
  id: id(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  bankTransactionId: uuid('bank_transaction_id')
    .notNull()
    .references(() => bankTransactions.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  claimId: uuid('claim_id').references(() => claims.id),
  amountMinor: money('amount_minor').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: created(),
});
export const auditEvents = pgTable(
  'audit_events',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    createdAt: created(),
  },
  (t) => [index().on(t.companyId, t.createdAt)],
);
export const closedPeriods = pgTable(
  'closed_periods',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    month: text('month').notNull(),
    closedBy: uuid('closed_by')
      .notNull()
      .references(() => users.id),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.month)],
);
export const reconciliationDecisions = pgTable(
  'reconciliation_decisions',
  {
    id: id(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => bankTransactions.id),
    targetId: uuid('target_id').notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason').notNull(),
    createdAt: created(),
  },
  (t) => [unique().on(t.companyId, t.bankId, t.targetId)],
);
export const invoiceCancellations = pgTable('invoice_cancellations', {
  id: id(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  invoiceId: uuid('invoice_id')
    .notNull()
    .unique()
    .references(() => invoices.id),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: created(),
});
