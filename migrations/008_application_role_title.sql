ALTER TABLE applications
ADD COLUMN role_title TEXT;

CREATE INDEX applications_role_title_idx
ON applications USING gin (to_tsvector('simple', coalesce(role_title, '')));
