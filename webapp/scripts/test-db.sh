#!/bin/bash
# Database integration tests: a throwaway database on a real Postgres, every migration applied, then
# tests/db/*.test.ts run against it with the real server code (no Next server, no chain). The database is dropped after.
# Needs TEST_PG_ADMIN_URL: a Postgres URL for a role that may CREATE DATABASE (never your production database).
# Usage: TEST_PG_ADMIN_URL=postgres://user:pass@127.0.0.1:5432/postgres npm run test:db [-- tests/db/one.test.ts]
set -euo pipefail
app="$(cd "$(dirname "$0")/.." && pwd)"
admin="${TEST_PG_ADMIN_URL:?set TEST_PG_ADMIN_URL to a Postgres role that may create databases}"
name="lexari_test_$(date +%s)_$RANDOM"
pg_admin() { node -e 'const p=require("postgres");const s=p(process.argv[1],{max:1,onnotice:()=>{}});s.unsafe(process.argv[2]).then(()=>s.end()).catch(e=>{console.error(e.message);process.exit(1)})' "${admin}" "$1"; }
cd "${app}"
pg_admin "create database ${name}"
trap 'pg_admin "drop database if exists ${name} with (force)" || true' EXIT
export DATABASE_URL="${admin%/*}/${name}"
node server/db/migrate.mjs >/dev/null
export SESSION_SECRET="${SESSION_SECRET:-test-session-secret-not-for-production}"
export NEXT_PUBLIC_SOLANA_CLUSTER=devnet
files=("$@"); [ ${#files[@]} -gt 0 ] || files=(tests/db/*.test.ts)
npx tsx --test --test-concurrency=1 "${files[@]}"
