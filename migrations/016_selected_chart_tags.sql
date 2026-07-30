CREATE TABLE selected_chart_tags (
  tag_name TEXT PRIMARY KEY CHECK (length(trim(tag_name)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
