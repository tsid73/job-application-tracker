CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (length(trim(target_type)) > 0),
  target_id TEXT NOT NULL CHECK (length(trim(target_id)) > 0),
  action TEXT NOT NULL CHECK (length(trim(action)) > 0),
  details TEXT,
  actor_ip TEXT,
  actor_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_created_at_idx ON audit_events(created_at DESC);
CREATE INDEX audit_events_application_id_idx ON audit_events(application_id);
CREATE INDEX audit_events_target_idx ON audit_events(target_type, target_id);
