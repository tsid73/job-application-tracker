CREATE TYPE application_status AS ENUM (
  'applied',
  'interview_scheduled',
  'accepted',
  'rejected',
  'withdrawn',
  'offer',
  'ghosted'
);

CREATE TABLE cv_versions (
  id BIGSERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  version_label TEXT,
  is_latest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_latest_cv ON cv_versions ((is_latest)) WHERE is_latest;

CREATE TABLE applications (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL CHECK (length(trim(company_name)) > 0),
  job_link TEXT,
  job_description TEXT,
  status application_status NOT NULL DEFAULT 'applied',
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interview_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    job_link IS NOT NULL AND length(trim(job_link)) > 0
    OR job_description IS NOT NULL AND length(trim(job_description)) > 0
  ),
  CHECK (interview_date IS NULL OR status = 'interview_scheduled')
);

CREATE TABLE application_cvs (
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  cv_id BIGINT NOT NULL REFERENCES cv_versions(id) ON DELETE RESTRICT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, cv_id)
);

CREATE TABLE status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status application_status,
  to_status application_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE application_notes (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
);

CREATE TABLE application_tags (
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (application_id, tag_id)
);

CREATE INDEX applications_status_idx ON applications(status);
CREATE INDEX applications_company_idx ON applications USING gin (to_tsvector('simple', company_name));
CREATE INDEX applications_interview_date_idx ON applications(interview_date) WHERE interview_date IS NOT NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
