#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

DB_CLIENT="${DB_CLIENT:-pglite}"
PGLITE_DATA_DIR="${PGLITE_DATA_DIR:-data/pglite}"
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/job_tracker}"
UPLOAD_DIR="${UPLOAD_DIR:-uploads}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${1:-$ROOT_DIR/backups/job-tracker-${DB_CLIENT}-${STAMP}}"
UPLOAD_SOURCE_DIR="$ROOT_DIR/$UPLOAD_DIR"

mkdir -p "$OUTPUT_DIR"

if [[ "$DB_CLIENT" == "postgres" ]]; then
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "pg_dump is required for PostgreSQL backups" >&2
    exit 1
  fi

  pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$OUTPUT_DIR/database.sql"
else
  SOURCE_DIR="$ROOT_DIR/$PGLITE_DATA_DIR"
  if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "PGlite data directory not found: $SOURCE_DIR" >&2
    exit 1
  fi

  SNAPSHOT_DIR="$OUTPUT_DIR/.pglite-snapshot"
  mkdir -p "$SNAPSHOT_DIR"
  cp -a "$SOURCE_DIR"/. "$SNAPSHOT_DIR"/
  tar -C "$SNAPSHOT_DIR" -czf "$OUTPUT_DIR/database-pglite.tar.gz" .
  rm -rf "$SNAPSHOT_DIR"
fi

if [[ -d "$UPLOAD_SOURCE_DIR" ]]; then
  tar -C "$UPLOAD_SOURCE_DIR" -czf "$OUTPUT_DIR/uploads.tar.gz" .
else
  mkdir -p "$UPLOAD_SOURCE_DIR"
  tar -C "$UPLOAD_SOURCE_DIR" -czf "$OUTPUT_DIR/uploads.tar.gz" .
fi

cat > "$OUTPUT_DIR/manifest.json" <<EOF
{
  "created_at": "$(date -Iseconds)",
  "db_client": "$DB_CLIENT",
  "database_file": "$([[ "$DB_CLIENT" == "postgres" ]] && echo database.sql || echo database-pglite.tar.gz)",
  "uploads_file": "uploads.tar.gz",
  "upload_dir": "$UPLOAD_DIR"
}
EOF

echo "Created backup bundle at $OUTPUT_DIR"
