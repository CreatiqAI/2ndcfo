ALTER TABLE documents ADD COLUMN default_payment_term_days integer
  CHECK (default_payment_term_days BETWEEN 0 AND 365);
