ALTER TABLE cv_versions
ADD COLUMN extracted_text TEXT,
ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE applications
ADD COLUMN salary TEXT,
ADD COLUMN location TEXT,
ADD COLUMN recruiter TEXT,
ADD COLUMN contact_person TEXT;

CREATE TABLE ai_documents (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  cv_id BIGINT REFERENCES cv_versions(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('tailored_cv', 'cover_letter', 'follow_up_email', 'role_fit')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cv_versions_deleted_at_idx ON cv_versions(deleted_at);
CREATE INDEX ai_documents_application_id_idx ON ai_documents(application_id);
CREATE INDEX activity_logs_application_id_idx ON activity_logs(application_id);
CREATE INDEX activity_logs_created_at_idx ON activity_logs(created_at);
