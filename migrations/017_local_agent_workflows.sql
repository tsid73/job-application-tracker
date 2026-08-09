CREATE TABLE research_sources (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('job_posting', 'company_page', 'recruiter', 'manual_note', 'generated')),
  url TEXT,
  title TEXT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  confidence INTEGER NOT NULL DEFAULT 70 CHECK (confidence >= 0 AND confidence <= 100),
  warnings TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_context_snapshots (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  research_source_id BIGINT REFERENCES research_sources(id) ON DELETE SET NULL,
  company_name TEXT,
  role_title TEXT,
  job_link TEXT,
  company_url TEXT,
  recruiter TEXT,
  location TEXT,
  job_description TEXT,
  extraction_confidence INTEGER NOT NULL DEFAULT 70 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 100),
  warnings TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL CHECK (length(trim(source_table)) > 0),
  source_id BIGINT NOT NULL,
  chunk_type TEXT NOT NULL CHECK (length(trim(chunk_type)) > 0),
  title TEXT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_runs (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('job_description_analysis', 'fit_evaluation', 'draft_generation', 'company_research')),
  query TEXT NOT NULL,
  matched_chunk_ids TEXT NOT NULL DEFAULT '[]',
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('job_description_analysis', 'fit_evaluation', 'draft_generation', 'company_research')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  provider_name TEXT NOT NULL DEFAULT 'mock-local',
  model_name TEXT NOT NULL DEFAULT 'deterministic-local-workflow',
  input_summary TEXT,
  retrieved_context TEXT,
  output_summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE agent_steps (
  id BIGSERIAL PRIMARY KEY,
  agent_run_id BIGINT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL CHECK (step_order >= 0),
  step_type TEXT NOT NULL CHECK (length(trim(step_type)) > 0),
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')) DEFAULT 'completed',
  input_text TEXT,
  output_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pending_agent_actions (
  id BIGSERIAL PRIMARY KEY,
  agent_run_id BIGINT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('update_preparation', 'create_note', 'create_todo')),
  target_type TEXT NOT NULL CHECK (length(trim(target_type)) > 0),
  target_id TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'applied', 'rejected')) DEFAULT 'proposed',
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX research_sources_application_id_idx ON research_sources(application_id, created_at DESC);
CREATE INDEX job_context_snapshots_application_id_idx ON job_context_snapshots(application_id, created_at DESC);
CREATE INDEX knowledge_chunks_application_id_idx ON knowledge_chunks(application_id, chunk_type, created_at DESC);
CREATE INDEX retrieval_runs_application_id_idx ON retrieval_runs(application_id, created_at DESC);
CREATE INDEX agent_runs_application_id_idx ON agent_runs(application_id, created_at DESC);
CREATE INDEX agent_steps_run_id_idx ON agent_steps(agent_run_id, step_order);
CREATE INDEX pending_agent_actions_application_id_idx ON pending_agent_actions(application_id, status, created_at DESC);
