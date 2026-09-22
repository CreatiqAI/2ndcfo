import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from './db';
import { salarySlips, memberships, users, companies } from './db/schema';
import {
  type Actor,
  requireRole,
  assert,
  audit,
  lockCompany,
  openPeriod,
  minor,
  sumMinor,
} from './core';
import { salaryPdf, type SalaryDetails } from './salary-pdf';
import { workspacePayslipTemplate } from '../lib/payslip-template';
const line = z.string().trim().max(100).default('');
export const earningLabels = [
  'Basic Salary',
  'Attendance Allowance',
  'Transportation Allowance',
  'Meal Allowance',
  'Performance Bonus',
];
export function salaryAmounts(values: string[], deductions: string) {
  const amounts = values.map(minor),
    deductionMinor = minor(deductions);
  assert(
    amounts.every((v) => v >= 0) && deductionMinor >= 0,
    'Salary and deduction amounts cannot be negative.',
  );
  const grossMinor = sumMinor(amounts),
    netMinor = grossMinor - deductionMinor;
  assert(netMinor >= 0, 'Deductions cannot exceed earnings.');
  return { amounts, deductionMinor, grossMinor, netMinor };
}
export async function createSalary(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z
    .object({
      employeeId: z.uuid(),
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      basic: z.string(),
      attendance: z.string().default('0'),
      transport: z.string().default('0'),
      meal: z.string().default('0'),
      bonus: z.string().default('0'),
      deductions: z.string().default('0'),
      deductionLabel: line,
      employeeAddress: line,
      employeeContact: line,
      companyAddress: line,
      companyContact: line,
      signatory: line,
      designation: line,
      bankName: line,
      bankAccount: line,
    })
    .parse(input);
  const amounts = salaryAmounts(
    [data.basic, data.attendance, data.transport, data.meal, data.bonus],
    data.deductions,
  );
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    await openPeriod(tx, actor.companyId, data.month);
    const [employee] = await tx
      .select({ name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(eq(memberships.companyId, actor.companyId), eq(memberships.userId, data.employeeId)),
      );
    assert(employee, 'Select an employee in this workspace.');
    const [company] = await tx.select().from(companies).where(eq(companies.id, actor.companyId));
    const details: SalaryDetails = {
      template: workspacePayslipTemplate(company.payslipTemplate),
      employeeName: employee.name,
      companyName: company.name,
      ...data,
      earnings: earningLabels.map((label, i) => ({ label, amount: amounts.amounts[i] })),
      ...amounts,
    };
    // Verify that the template can render before saving an immutable salary record.
    try {
      await salaryPdf(details);
    } catch {
      assert(
        false,
        'Some text is too long for the payslip template. Shorten the address, contact or signatory fields and try again.',
      );
    }
    const [record] = await tx
      .insert(salarySlips)
      .values({
        companyId: actor.companyId,
        employeeId: data.employeeId,
        month: data.month,
        details,
        grossMinor: amounts.grossMinor,
        deductionMinor: amounts.deductionMinor,
        netMinor: amounts.netMinor,
        createdBy: actor.userId,
      })
      .onConflictDoNothing()
      .returning();
    assert(
      record,
      'A payslip already exists for this employee and month. Download it from Salary.',
      409,
    );
    await audit(tx, actor, record.id, 'salary.created', null, {
      employeeId: data.employeeId,
      month: data.month,
      grossMinor: amounts.grossMinor,
      netMinor: amounts.netMinor,
    });
    return { id: record.id };
  });
}
export async function getSalary(actor: Actor, id: string) {
  requireRole(actor, ['Admin', 'Finance']);
  const [row] = await (
    await getDb()
  )
    .select()
    .from(salarySlips)
    .where(and(eq(salarySlips.id, z.uuid().parse(id)), eq(salarySlips.companyId, actor.companyId)));
  assert(row, 'Payslip not found.', 404);
  return row;
}
