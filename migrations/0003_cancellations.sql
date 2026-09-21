CREATE TABLE invoice_cancellations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), invoice_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL REFERENCES users(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(company_id,invoice_id) REFERENCES invoices(company_id,id));
--> statement-breakpoint
CREATE TRIGGER cancellation_immutable BEFORE UPDATE OR DELETE ON invoice_cancellations FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
