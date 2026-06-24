#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_FILE="${DB_FILE:-$ROOT_DIR/data.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "Database file not found: $DB_FILE"
  exit 1
fi

cp "$DB_FILE" "$BACKUP_DIR/data-$TS.sqlite"

echo "Backup created at $BACKUP_DIR/data-$TS.sqlite"
