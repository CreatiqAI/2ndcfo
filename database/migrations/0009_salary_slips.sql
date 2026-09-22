CREATE TABLE salary_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  employee_id uuid NOT NULL REFERENCES users(id), month text NOT NULL CHECK(month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  details jsonb NOT NULL, gross_minor bigint NOT NULL CHECK(gross_minor >= 0),
  deduction_minor bigint NOT NULL CHECK(deduction_minor >= 0),
  net_minor bigint NOT NULL CHECK(net_minor >= 0 AND net_minor=gross_minor-deduction_minor),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,employee_id,month)
);
--> statement-breakpoint
ALTER TABLE salary_slips ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TRIGGER salary_slip_immutable BEFORE UPDATE OR DELETE ON salary_slips FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
