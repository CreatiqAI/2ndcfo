import { z } from 'zod';

export const payslipTemplateSchema = z.object({
  title: z.string().trim().min(1).max(24).default('Salary Slip'),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#454545'),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#f4f4f7'),
  footer: z.string().trim().max(40).default('Thank You.'),
  logo: z.string().max(1_400_000).default(''),
  logoSize: z.number().int().min(32).max(64).default(50),
  showSignature: z.boolean().default(true),
});
export type PayslipTemplate = z.infer<typeof payslipTemplateSchema>;
export const defaultPayslipTemplate = payslipTemplateSchema.parse({});
