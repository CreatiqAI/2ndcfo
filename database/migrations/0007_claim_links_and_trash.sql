CREATE TABLE claim_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  claim_id uuid NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  redeemed_at timestamptz, session_hash text UNIQUE, session_expires_at timestamptz,
  FOREIGN KEY(company_id,claim_id) REFERENCES claims(company_id,id)
);
--> statement-breakpoint
ALTER TABLE claim_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE record_trash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  invoice_id uuid UNIQUE, claim_id uuid UNIQUE, deleted boolean NOT NULL DEFAULT true,
  CHECK(num_nonnulls(invoice_id,claim_id)=1),
  FOREIGN KEY(company_id,invoice_id) REFERENCES invoices(company_id,id),
  FOREIGN KEY(company_id,claim_id) REFERENCES claims(company_id,id)
);
--> statement-breakpoint
ALTER TABLE record_trash ENABLE ROW LEVEL SECURITY;
