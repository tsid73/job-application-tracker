ALTER TABLE cv_versions
ADD COLUMN IF NOT EXISTS storage_kind TEXT NOT NULL DEFAULT 'local',
ADD COLUMN IF NOT EXISTS s3_bucket TEXT,
ADD COLUMN IF NOT EXISTS s3_key TEXT;

ALTER TABLE ai_documents
ADD COLUMN IF NOT EXISTS storage_kind TEXT NOT NULL DEFAULT 'local',
ADD COLUMN IF NOT EXISTS s3_bucket TEXT,
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version_group_id TEXT,
ADD COLUMN IF NOT EXISTS provider_requested TEXT,
ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'completed';

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  cv_id BIGINT REFERENCES cv_versions(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('tailored_cv', 'cover_letter', 'follow_up_email', 'role_fit', 'ats_check')),
  provider_requested TEXT NOT NULL CHECK (provider_requested IN ('gemini', 'aws', 'mock')),
  provider_used TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'fallback_completed')) DEFAULT 'queued',
  title TEXT NOT NULL,
  request_manifest_path TEXT,
  request_manifest_s3_key TEXT,
  result_s3_key TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  prompt_excerpt TEXT,
  source_context TEXT,
  document_id BIGINT REFERENCES ai_documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS cv_versions_storage_kind_idx ON cv_versions(storage_kind);
CREATE INDEX IF NOT EXISTS ai_documents_deleted_at_idx ON ai_documents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_documents_version_group_id_idx ON ai_documents(version_group_id) WHERE version_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_generation_jobs_application_id_idx ON ai_generation_jobs(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_generation_jobs_status_idx ON ai_generation_jobs(status, created_at DESC);
