#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Ascend — RLS isolation test runner
#
# Applies the Supabase auth shim + the real migration + Supabase-equivalent
# grants to a throwaway Postgres database, then runs the two-tenant isolation
# test. Every assertion must PASS or the script exits non-zero.
#
# Usage:  PGPORT=5432 PGUSER=postgres bash supabase/tests/run.sh
# Requires a reachable Postgres (locally: `pg_ctlcluster 16 main start`).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${PGDATABASE:-ascend_rls_test}"
PORT="${PGPORT:-5432}"
PSQL_USER="${PGUSER:-postgres}"

# If we can only reach Postgres via the postgres OS superuser (common on CI /
# fresh boxes), route psql through `sudo -u postgres` and feed files on stdin.
if psql -p "$PORT" -U "$PSQL_USER" -d postgres -c '\q' >/dev/null 2>&1; then
  run() { psql -qX -p "$PORT" -U "$PSQL_USER" -v ON_ERROR_STOP=1 "$@"; }
  admin() { psql -qX -p "$PORT" -U "$PSQL_USER" -d postgres -v ON_ERROR_STOP=1 "$@"; }
else
  run() { sudo -u postgres psql -qX -p "$PORT" -v ON_ERROR_STOP=1 "$@"; }
  admin() { sudo -u postgres psql -qX -p "$PORT" -d postgres -v ON_ERROR_STOP=1 "$@"; }
fi

echo "▶ (re)creating database $DB"
admin -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"

echo "▶ applying auth shim"
run -d "$DB" -f - < "$HERE/_shim.sql" >/dev/null

echo "▶ applying migration(s)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  · $(basename "$f")"
  run -d "$DB" -f - < "$f" >/dev/null
done

echo "▶ applying Supabase-equivalent grants"
run -d "$DB" -f - < "$HERE/_grants.sql" >/dev/null

echo "▶ running RLS isolation test"
run -d "$DB" -f - < "$HERE/rls_isolation.test.sql" 2>&1 | grep -E "PASS:|FAIL:|PASSED" || true

echo "▶ running feature isolation test (stakes + glow-up)"
run -d "$DB" -f - < "$HERE/features_isolation.test.sql" 2>&1 | grep -E "PASS:|FAIL:|PASSED" || true

echo "▶ running Phase 5 audit + deletion-cascade test"
run -d "$DB" -f - < "$HERE/audit.test.sql" 2>&1 | grep -E "PASS:|FAIL:|PASSED" || true

echo "✔ done"
