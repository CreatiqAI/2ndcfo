ALTER TABLE companies ADD COLUMN payslip_template jsonb NOT NULL DEFAULT '{}'::jsonb;
