ALTER TABLE documents DROP CONSTRAINT documents_purpose_check;
--> statement-breakpoint
ALTER TABLE documents ADD CONSTRAINT documents_purpose_check CHECK (purpose IN ('invoice','claim','statement','payslip'));
--> statement-breakpoint
ALTER TABLE invoices DROP CONSTRAINT invoices_kind_check;
--> statement-breakpoint
ALTER TABLE invoices ADD CONSTRAINT invoices_kind_check CHECK (kind IN ('Sales Invoice','Supplier Invoice','Receipt','Claim Receipt','Other Financial Document','Payslip'));
