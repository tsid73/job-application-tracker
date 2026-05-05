CREATE TABLE saved_filters (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  search TEXT,
  status application_status,
  tag TEXT,
  archived TEXT NOT NULL DEFAULT 'false' CHECK (archived IN ('false', 'true', 'all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER saved_filters_set_updated_at
BEFORE UPDATE ON saved_filters
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE cv_versions
ADD COLUMN file_hash TEXT;

CREATE UNIQUE INDEX cv_versions_file_hash_unique_idx
ON cv_versions(file_hash)
WHERE file_hash IS NOT NULL;

ALTER TABLE ai_documents
ADD COLUMN provider_name TEXT,
ADD COLUMN model_name TEXT,
ADD COLUMN prompt_excerpt TEXT,
ADD COLUMN source_context TEXT;

ALTER TABLE ai_documents
DROP CONSTRAINT IF EXISTS ai_documents_document_type_check;

ALTER TABLE ai_documents
ADD CONSTRAINT ai_documents_document_type_check
CHECK (document_type IN ('tailored_cv', 'cover_letter', 'follow_up_email', 'role_fit', 'ats_check'));

CREATE INDEX saved_filters_created_at_idx ON saved_filters(created_at DESC);
