ALTER TABLE documents ADD COLUMN upload_direction text CHECK (upload_direction IN ('in', 'out'));
