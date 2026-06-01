ALTER TABLE applications
ADD COLUMN IF NOT EXISTS next_action TEXT,
ADD COLUMN IF NOT EXISTS next_action_due_date DATE;

CREATE INDEX IF NOT EXISTS applications_next_action_due_date_idx
ON applications(next_action_due_date)
WHERE archived_at IS NULL AND next_action_due_date IS NOT NULL;
