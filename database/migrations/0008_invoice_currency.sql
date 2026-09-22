ALTER TABLE documents ADD COLUMN upload_currency text NOT NULL DEFAULT 'MYR'
  CHECK(upload_currency IN ('MYR','USD','SGD','EUR','GBP','AUD','CAD','HKD'));
--> statement-breakpoint
CREATE TABLE fx_rates (
  key text PRIMARY KEY, currency text NOT NULL, requested_date date NOT NULL,
  rate_date date NOT NULL, rate text NOT NULL, source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
