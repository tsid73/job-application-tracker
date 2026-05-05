CREATE TABLE application_preparation (
  application_id BIGINT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  about_company TEXT,
  company_values TEXT,
  application_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER application_preparation_set_updated_at
BEFORE UPDATE ON application_preparation
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE recruiter_questions (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (length(trim(question)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER recruiter_questions_set_updated_at
BEFORE UPDATE ON recruiter_questions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX recruiter_questions_application_id_idx
ON recruiter_questions(application_id, sort_order, id);

CREATE TABLE hiring_feedback (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'self_note'
    CHECK (source_type IN ('recruiter', 'interviewer', 'hiring_manager', 'self_note')),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hiring_feedback_application_id_idx
ON hiring_feedback(application_id, created_at DESC);

CREATE TABLE application_todos (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER application_todos_set_updated_at
BEFORE UPDATE ON application_todos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX application_todos_application_id_idx
ON application_todos(application_id, completed, due_date, id);

CREATE TABLE job_boards (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  url TEXT,
  notes TEXT,
  last_checked_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER job_boards_set_updated_at
BEFORE UPDATE ON job_boards
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX job_boards_is_active_idx
ON job_boards(is_active, updated_at DESC);
