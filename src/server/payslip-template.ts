import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { workspacePayslipTemplate } from '../lib/payslip-template';
import { type Actor, requireRole, assert, audit, lockCompany } from './core';
import { getDb } from './db';
import { companies } from './db/schema';
import { salaryPdf, type SalaryDetails } from './salary-pdf';

export async function preparePayslipTemplate(input: unknown) {
  const template = workspacePayslipTemplate(input);
  if (template.logo) {
    assert(
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(template.logo),
      'Upload a PNG or JPEG logo.',
    );
    const bytes = Buffer.from(template.logo.split(',')[1], 'base64');
    assert(bytes.length <= 1_048_576, 'Logo must be 1 MB or smaller.');
    try {
      const img = sharp(bytes, { limitInputPixels: 16_000_000 });
      const metadata = await img.metadata();
      assert(['png', 'jpeg'].includes(metadata.format || ''), 'Upload a PNG or JPEG logo.');
      const png = await img
        .rotate()
        .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      template.logo = `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      assert(
        false,
        'This logo could not be read. Use a valid PNG/JPEG up to 1 MB and 16 megapixels.',
      );
    }
  }
  return template;
}

export function templateSample(template: SalaryDetails['template']): SalaryDetails {
  return {
    template,
    employeeName: 'Sample Employee',
    employeeAddress: 'Employee address',
    employeeContact: 'employee@example.com',
    companyName: 'Your Company',
    companyAddress: 'Company address',
    companyContact: 'Company contact',
    signatory: 'Authorised signatory',
    designation: 'Director',
    month: '2026-09',
    earnings: [
      { label: 'Basic Salary', amount: 280000 },
      { label: 'Attendance Allowance', amount: 12000 },
      { label: 'Transportation Allowance', amount: 9000 },
      { label: 'Meal Allowance', amount: 7000 },
      { label: 'Performance Bonus', amount: 25000 },
    ],
    deductionLabel: 'Deductions',
    deductionMinor: 10000,
    grossMinor: 333000,
    netMinor: 323000,
  };
}

export async function changePayslipTemplate(actor: Actor, input: unknown, preview = false) {
  requireRole(actor, ['Admin', 'Finance']);
  const template = await preparePayslipTemplate(input);
  const pdf = await salaryPdf(templateSample(template));
  if (preview) return { pdf: Buffer.from(pdf).toString('base64') };
  await (
    await getDb()
  ).transaction(async (tx) => {
    await lockCompany(tx, actor);
    await tx
      .update(companies)
      .set({ payslipTemplate: template })
      .where(eq(companies.id, actor.companyId));
    const { logo, ...appearance } = template;
    await audit(tx, actor, actor.companyId, 'salary.template.updated', null, {
      ...appearance,
      hasLogo: !!logo,
    });
  });
  return { saved: true };
}
