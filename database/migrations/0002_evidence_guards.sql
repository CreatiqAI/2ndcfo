CREATE TABLE reconciliation_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), bank_id uuid NOT NULL, target_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,bank_id,target_id), FOREIGN KEY(company_id,bank_id) REFERENCES bank_transactions(company_id,id));
--> statement-breakpoint
CREATE TRIGGER reconciliation_decision_immutable BEFORE UPDATE OR DELETE ON reconciliation_decisions FOR EACH ROW EXECUTE FUNCTION immutable_evidence();
--> statement-breakpoint
CREATE FUNCTION approved_claim_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' OR OLD.status='Finance Approved' THEN RAISE EXCEPTION 'Approved claim requires an amendment; deletion is forbidden'; END IF; RETURN NEW; END; $$;
--> statement-breakpoint
CREATE TRIGGER approved_claim_guard BEFORE UPDATE OR DELETE ON claims FOR EACH ROW EXECUTE FUNCTION approved_claim_immutable();
--> statement-breakpoint
CREATE FUNCTION bank_facts_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Bank evidence cannot be deleted'; END IF; IF (to_jsonb(NEW)-'category') IS DISTINCT FROM (to_jsonb(OLD)-'category') OR OLD.category IS NOT NULL THEN RAISE EXCEPTION 'Imported bank facts are immutable'; END IF; RETURN NEW; END; $$;
--> statement-breakpoint
CREATE TRIGGER bank_facts_guard BEFORE UPDATE OR DELETE ON bank_transactions FOR EACH ROW EXECUTE FUNCTION bank_facts_immutable();
