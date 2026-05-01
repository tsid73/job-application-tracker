ALTER TABLE applications
ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX applications_archived_at_idx ON applications(archived_at);
