CREATE TABLE application_process_steps (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  step_group TEXT NOT NULL CHECK (step_group IN ('screening', 'assessment', 'interview', 'discussion', 'other')),
  step_name TEXT NOT NULL CHECK (length(trim(step_name)) > 0),
  step_state TEXT NOT NULL CHECK (step_state IN ('scheduled', 'completed', 'cancelled')),
  event_date DATE NOT NULL,
  event_time TIME,
  response_state TEXT NOT NULL CHECK (response_state IN ('not_applicable', 'awaiting_response', 'advanced', 'not_advanced', 'on_hold', 'no_response', 'other')),
  response_detail TEXT,
  response_date DATE,
  follow_up_due_date DATE,
  feedback_received BOOLEAN,
  tracking_state TEXT NOT NULL CHECK (tracking_state IN ('open', 'closed')),
  closure_reason TEXT CHECK (closure_reason IN ('advanced', 'not_advanced', 'no_response', 'cancelled', 'withdrew', 'other')),
  closed_at TIMESTAMPTZ,
  contact_name TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'legacy_interview_date')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, position),
  CHECK (
    (tracking_state = 'open' AND closure_reason IS NULL AND closed_at IS NULL)
    OR (tracking_state = 'closed' AND closure_reason IS NOT NULL AND closed_at IS NOT NULL)
  )
);

CREATE TRIGGER application_process_steps_set_updated_at
BEFORE UPDATE ON application_process_steps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX application_process_steps_application_date_idx
ON application_process_steps(application_id, event_date, id);

CREATE INDEX application_process_steps_open_follow_up_idx
ON application_process_steps(follow_up_due_date, application_id)
WHERE tracking_state = 'open' AND follow_up_due_date IS NOT NULL;

CREATE INDEX application_process_steps_open_scheduled_idx
ON application_process_steps(event_date, application_id)
WHERE tracking_state = 'open' AND step_state = 'scheduled';

CREATE UNIQUE INDEX application_process_steps_one_scheduled_legacy_idx
ON application_process_steps(application_id)
WHERE source = 'legacy_interview_date' AND step_state = 'scheduled';

INSERT INTO application_process_steps (
  application_id,
  position,
  step_group,
  step_name,
  step_state,
  event_date,
  response_state,
  tracking_state,
  source
)
SELECT
  id,
  1,
  'interview',
  'Interview',
  'scheduled',
  interview_date,
  'not_applicable',
  'open',
  'legacy_interview_date'
FROM applications
WHERE interview_date IS NOT NULL
ON CONFLICT (application_id)
WHERE source = 'legacy_interview_date' AND step_state = 'scheduled'
DO NOTHING;
