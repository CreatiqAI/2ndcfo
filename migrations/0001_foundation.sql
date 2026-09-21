CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, currency text NOT NULL DEFAULT 'MYR', timezone text NOT NULL DEFAULT 'Asia/Kuala_Lumpur', created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('Admin','Finance','Manager','Employee','Accountant')), department text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,user_id));
--> statement-breakpoint
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE auth_attempts (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
--> statement-breakpoint
CREATE TABLE claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), employee_id uuid NOT NULL REFERENCES users(id), title text NOT NULL, department text, month text NOT NULL CHECK(month ~ '^\d{4}-(0[1-9]|1[0-2])$'), currency text NOT NULL, claimed_minor bigint NOT NULL CHECK(claimed_minor >= 0), status text NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Needs Review','Manager Approved','Finance Approved','Rejected')), manager_id uuid REFERENCES users(id), finance_id uuid REFERENCES users(id), exception_reason text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id));
--> statement-breakpoint
CREATE TABLE documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), uploader_id uuid NOT NULL REFERENCES users(id), claim_id uuid, batch_id uuid NOT NULL, name text NOT NULL, storage_key text NOT NULL UNIQUE, mime text NOT NULL, size integer NOT NULL CHECK(size > 0), hash text NOT NULL, image_hash text, purpose text NOT NULL CHECK(purpose IN ('invoice','claim','statement')), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id), FOREIGN KEY(company_id,claim_id) REFERENCES claims(company_id,id));
--> statement-breakpoint
CREATE INDEX documents_company_hash ON documents(company_id,hash);
--> statement-breakpoint
CREATE TABLE extraction_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), document_id uuid NOT NULL UNIQUE, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','complete','failed')), attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(company_id,document_id) REFERENCES documents(company_id,id));
--> statement-breakpoint
CREATE TABLE extractions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), document_id uuid NOT NULL, provider text NOT NULL, model text, raw jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(company_id,document_id) REFERENCES documents(company_id,id));
--> statement-breakpoint
CREATE TABLE invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), document_id uuid NOT NULL, claim_id uuid, page_start integer NOT NULL DEFAULT 1 CHECK(page_start > 0), page_end integer NOT NULL DEFAULT 1 CHECK(page_end >= page_start), kind text NOT NULL CHECK(kind IN ('Sales Invoice','Supplier Invoice','Receipt','Claim Receipt','Other Financial Document')), party text, number text, invoice_date date, due_date date, description text, product text, payment_terms text, bank_reference text, subtotal_minor bigint CHECK(subtotal_minor >= 0), tax_minor bigint CHECK(tax_minor >= 0), total_minor bigint CHECK(total_minor > 0), currency text, category text, confidence integer NOT NULL DEFAULT 0 CHECK(confidence BETWEEN 0 AND 100), review_status text NOT NULL DEFAULT 'Needs Review' CHECK(review_status IN ('Needs Review','Ready','Approved','Rejected')), lifecycle text NOT NULL DEFAULT 'Draft' CHECK(lifecycle IN ('Draft','Issued','Cancelled')), duplicate_of uuid, duplicate_reason text, approved_by uuid REFERENCES users(id), approved_at timestamptz, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id), UNIQUE(document_id,page_start), FOREIGN KEY(company_id,document_id) REFERENCES documents(company_id,id), FOREIGN KEY(company_id,claim_id) REFERENCES claims(company_id,id), FOREIGN KEY(company_id,duplicate_of) REFERENCES invoices(company_id,id), CHECK(review_status <> 'Approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND total_minor > 0 AND currency IS NOT NULL AND invoice_date IS NOT NULL AND party IS NOT NULL AND category IS NOT NULL)));
--> statement-breakpoint
CREATE INDEX invoices_company_review ON invoices(company_id,review_status);
--> statement-breakpoint
CREATE TABLE bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL, currency text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id));
--> statement-breakpoint
CREATE TABLE statements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), account_id uuid NOT NULL, document_id uuid NOT NULL, month text NOT NULL CHECK(month ~ '^\d{4}-(0[1-9]|1[0-2])$'), opening_minor bigint, closing_minor bigint, status text NOT NULL DEFAULT 'Needs Review' CHECK(status IN ('Needs Review','Imported','Rejected')), draft jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id), FOREIGN KEY(company_id,account_id) REFERENCES bank_accounts(company_id,id), FOREIGN KEY(company_id,document_id) REFERENCES documents(company_id,id));
--> statement-breakpoint
CREATE TABLE bank_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), account_id uuid NOT NULL, statement_id uuid NOT NULL, row_index integer NOT NULL, date date NOT NULL, description text NOT NULL, reference text, direction text NOT NULL CHECK(direction IN ('in','out')), amount_minor bigint NOT NULL CHECK(amount_minor > 0), balance_minor bigint, currency text NOT NULL, fingerprint text NOT NULL, category text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id), UNIQUE(statement_id,row_index), FOREIGN KEY(company_id,account_id) REFERENCES bank_accounts(company_id,id), FOREIGN KEY(company_id,statement_id) REFERENCES statements(company_id,id));
--> statement-breakpoint
CREATE INDEX bank_company_fingerprint ON bank_transactions(company_id,fingerprint);
--> statement-breakpoint
CREATE TABLE allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), bank_transaction_id uuid NOT NULL, invoice_id uuid, claim_id uuid, amount_minor bigint NOT NULL CHECK(amount_minor > 0), created_by uuid NOT NULL REFERENCES users(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK(num_nonnulls(invoice_id,claim_id)=1), FOREIGN KEY(company_id,bank_transaction_id) REFERENCES bank_transactions(company_id,id), FOREIGN KEY(company_id,invoice_id) REFERENCES invoices(company_id,id), FOREIGN KEY(company_id,claim_id) REFERENCES claims(company_id,id));
--> statement-breakpoint
CREATE INDEX allocation_bank ON allocations(company_id,bank_transaction_id);
--> statement-breakpoint
CREATE INDEX allocation_invoice ON allocations(company_id,invoice_id);
--> statement-breakpoint
CREATE INDEX allocation_claim ON allocations(company_id,claim_id);
--> statement-breakpoint
CREATE TABLE audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), actor_id uuid NOT NULL REFERENCES users(id), entity_id text NOT NULL, action text NOT NULL, before jsonb, after jsonb, reason text, created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE INDEX audit_company_date ON audit_events(company_id,created_at DESC);
--> statement-breakpoint
CREATE TABLE closed_periods (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), month text NOT NULL, closed_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,month));
--> statement-breakpoint
CREATE FUNCTION immutable_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence is append-only'; END; $$;
--> statement-breakpoint
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
--> statement-breakpoint
CREATE TRIGGER extraction_immutable BEFORE UPDATE OR DELETE ON extractions FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
--> statement-breakpoint
CREATE TRIGGER allocation_immutable BEFORE UPDATE OR DELETE ON allocations FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
--> statement-breakpoint
CREATE TRIGGER document_immutable BEFORE UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
--> statement-breakpoint
CREATE FUNCTION approved_invoice_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.review_status = 'Approved' THEN RAISE EXCEPTION 'Approved invoice requires an amendment'; END IF; IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial records cannot be deleted'; END IF; RETURN NEW; END; $$;
--> statement-breakpoint
CREATE TRIGGER approved_invoice_guard BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION approved_invoice_immutable();