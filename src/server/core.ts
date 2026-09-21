import { and, eq, sql } from 'drizzle-orm';
import type { DB } from './db';
import { auditEvents, closedPeriods, companies, memberships } from './db/schema';
export type Role = 'Admin' | 'Finance' | 'Manager' | 'Employee' | 'Accountant';
export type Actor = { userId: string; companyId: string; role: Role; department: string | null };
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role)) throw new AppError(403, 'Your role does not allow this action.');
}
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export async function lockCompany(tx: Tx, actor: Actor) {
  await tx.execute(sql`SELECT id FROM companies WHERE id = ${actor.companyId} FOR UPDATE`);
  const [member] = await tx
    .select()
    .from(memberships)
    .where(and(eq(memberships.companyId, actor.companyId), eq(memberships.userId, actor.userId)));
  assert(
    member && member.role === actor.role && member.department === actor.department,
    'Workspace membership changed. Refresh and try again.',
    403,
  );
}
export async function openPeriod(tx: Tx, companyId: string, date: string | null) {
  if (!date) return;
  const [closed] = await tx
    .select()
    .from(closedPeriods)
    .where(and(eq(closedPeriods.companyId, companyId), eq(closedPeriods.month, date.slice(0, 7))));
  assert(!closed, 'This month is closed. A recorded amendment is required.', 409);
}
export async function audit(
  tx: Tx,
  actor: Actor,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  reason?: string,
) {
  await tx.insert(auditEvents).values({
    companyId: actor.companyId,
    actorId: actor.userId,
    entityId,
    action,
    before: before ?? null,
    after: after ?? null,
    reason,
  });
}
export const currencies = ['MYR', 'USD', 'SGD', 'EUR', 'GBP', 'AUD', 'CAD', 'HKD'] as const;
export const categories = [
  'Subscription Revenue',
  'Setup Fee',
  'Project Revenue',
  'Website Development',
  'Custom Development',
  'Consultation',
  'Commission',
  'Other Revenue',
  'Payroll',
  'Marketing',
  'Advertising',
  'Software',
  'Cloud / API',
  'Office',
  'Rental',
  'Utilities',
  'Sales Commission',
  'Travel',
  'Entertainment',
  'Professional Fees',
  'Accounting',
  'Legal',
  'R&D',
  'Equipment',
  'Bank Charges',
  'Other Expenses',
  'Grab / Transport',
  'Petrol',
  'Parking',
  'Toll',
  'Meals',
  'Client Entertainment',
  'Hotel',
  'Flight',
  'Office Purchase',
  'Miscellaneous',
];
export function minor(value: string | number): number {
  const str = String(value).trim();
  assert(
    /^-?\d+(\.\d{1,2})?$/.test(str),
    'Enter a decimal amount with at most two decimal places.',
  );
  const negative = str.startsWith('-');
  const [whole, fraction = ''] = str.replace('-', '').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  assert(result <= BigInt(Number.MAX_SAFE_INTEGER), 'Amount exceeds supported precision.');
  return Number(result) * (negative ? -1 : 1);
}
export function sumMinor(values: Iterable<number>): number {
  let total = 0n;
  for (const value of values) {
    assert(Number.isSafeInteger(value), 'Financial amount exceeds supported precision.');
    total += BigInt(value);
  }
  assert(
    total <= BigInt(Number.MAX_SAFE_INTEGER) && total >= BigInt(Number.MIN_SAFE_INTEGER),
    'Financial total exceeds supported precision.',
  );
  return Number(total);
}
export function decimal(value: number | null | undefined) {
  return value == null
    ? ''
    : `${value < 0 ? '-' : ''}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, '0')}`;
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function paymentStatus(
  total: number,
  paid: number,
  due: string | null,
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (paid >= total) return 'Paid';
  if (paid > 0) return 'Partially Paid';
  return due && due < asOf ? 'Overdue' : 'Unpaid';
}
export const normal = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
