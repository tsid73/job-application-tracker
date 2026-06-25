#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-directory-or-file>" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# || "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    if [[ -z "${!key+x}" ]]; then
      export "$key=$value"
    fi
  done < "$ENV_FILE"
fi

DB_CLIENT="${DB_CLIENT:-pglite}"
PGLITE_DATA_DIR="${PGLITE_DATA_DIR:-data/pglite}"
DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/job_tracker}"
UPLOAD_DIR="${UPLOAD_DIR:-uploads}"
BACKUP_PATH="$1"

if [[ ! -e "$BACKUP_PATH" ]]; then
  echo "Backup path not found: $BACKUP_PATH" >&2
  exit 1
fi

if [[ -f "$BACKUP_PATH" ]]; then
  if [[ "$DB_CLIENT" == "postgres" ]]; then
    if ! command -v psql >/dev/null 2>&1; then
      echo "psql is required for PostgreSQL restores" >&2
      exit 1
    fi

    psql "$DATABASE_URL" -f "$BACKUP_PATH"
    echo "Restored PostgreSQL backup from $BACKUP_PATH"
    exit 0
  fi

  TARGET_DIR="$ROOT_DIR/$PGLITE_DATA_DIR"
  mkdir -p "$TARGET_DIR"
  find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -C "$TARGET_DIR" -xzf "$BACKUP_PATH"
  echo "Restored PGlite backup from $BACKUP_PATH"
  exit 0
fi

BACKUP_DIR="$BACKUP_PATH"
UPLOAD_TARGET_DIR="$ROOT_DIR/$UPLOAD_DIR"

if [[ "$DB_CLIENT" == "postgres" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql is required for PostgreSQL restores" >&2
    exit 1
  fi

  psql "$DATABASE_URL" -f "$BACKUP_DIR/database.sql"
else
  TARGET_DIR="$ROOT_DIR/$PGLITE_DATA_DIR"
  node "$ROOT_DIR/scripts/pglite-restore.mjs" "$BACKUP_DIR/database-pglite.tar.gz" "$TARGET_DIR"
fi

mkdir -p "$UPLOAD_TARGET_DIR"
find "$UPLOAD_TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -C "$UPLOAD_TARGET_DIR" -xzf "$BACKUP_DIR/uploads.tar.gz"

echo "Restored database and uploads from $BACKUP_DIR"
