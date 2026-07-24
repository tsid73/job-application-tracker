WITH ranked_applications AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY id
      ORDER BY updated_at DESC, created_at DESC, ctid DESC
    ) AS duplicate_rank
  FROM applications
)
DELETE FROM applications AS application
USING ranked_applications AS ranked
WHERE application.ctid = ranked.ctid
  AND ranked.duplicate_rank > 1;

REINDEX TABLE applications;
