#!/usr/bin/env bash
# Lexari database backup (testnet "lexari" and mainnet "lexari_mainnet" on the local Postgres 18, port 5433).
# Install: /usr/local/sbin/lexari-db-backup.sh (root, 755). Scheduled by /etc/cron.d/lexari-db-backup.
#
#   lexari-db-backup.sh <db> [label]          pg_dump -Fc, checked with pg_restore --list, then copied to a second
#                                             directory; files older than 14 days are removed from both
#   lexari-db-backup.sh --restore-test <db>   restores the newest dump into a throwaway database, compares table
#                                             counts with the live one, then drops the throwaway database
#
# Read-only on the live database (pg_dump takes only ACCESS SHARE locks). Runs as the postgres OS user over the local
# socket, so no password is stored here. Two copies: /var/backups/lexari/<db> and /srv/lexari-backups-mirror/<db>.
# Both are on this one VPS disk: an off-host copy still needs a bucket or second server (set OFFSITE_CMD).
set -euo pipefail
PORT=5433
PRIMARY=/var/backups/lexari
MIRROR=/srv/lexari-backups-mirror
KEEP_DAYS=14
LOG=/var/log/lexari-db-backup.log
pg() { sudo -u postgres "$@"; }
log() { echo "$(date -Is) $*" | tee -a "$LOG"; }

if [ "${1:-}" = "--restore-test" ]; then
  db=${2:?db}
  f=$(ls -1t "$PRIMARY/$db"/*.dump 2>/dev/null | head -1); [ -n "$f" ] || { log "restore-test $db: no dump"; exit 1; }
  tmp="lexari_restore_test_$(date +%s)"
  pg createdb -p $PORT "$tmp"
  trap "sudo -u postgres dropdb -p $PORT --if-exists $tmp" EXIT
  pg pg_restore -p $PORT --no-owner --no-acl -d "$tmp" "$f" 2>>"$LOG"
  q="select count(*) from information_schema.tables where table_schema='public'"
  live=$(pg psql -p $PORT -d "$db" -Atc "$q"); rest=$(pg psql -p $PORT -d "$tmp" -Atc "$q")
  mig=$(pg psql -p $PORT -d "$tmp" -Atc "select count(*) from schema_migrations" 2>/dev/null || echo 0)
  if [ "$live" = "$rest" ] && [ "$rest" -gt 0 ]; then log "restore-test $db OK: $(basename "$f") -> $rest tables (live $live), $mig migrations"; else log "restore-test $db FAILED: restored $rest tables, live $live"; exit 1; fi
  exit 0
fi

db=${1:?usage: lexari-db-backup.sh <db> [label]}
label=${2:-daily}
[[ "$db" =~ ^[a-z_]+$ ]] || { echo "bad db name"; exit 1; }
install -d -m 700 -o postgres -g postgres "$PRIMARY" "$PRIMARY/$db" "$MIRROR" "$MIRROR/$db"
out="$PRIMARY/$db/$db-$(date +%Y%m%d-%H%M%S)-$label.dump"
pg pg_dump -p $PORT -Fc -Z 6 -f "$out" "$db"
size=$(stat -c %s "$out")
entries=$(pg pg_restore --list "$out" | grep -c ' TABLE DATA ' || true)
if [ "$size" -lt 1024 ] || [ "$entries" -lt 1 ]; then log "backup $db FAILED: $out is $size bytes, $entries table data entries"; exit 1; fi
cp -p "$out" "$MIRROR/$db/"
[ -n "${OFFSITE_CMD:-}" ] && { $OFFSITE_CMD "$out" && log "offsite copy ok" || log "offsite copy FAILED"; }
find "$PRIMARY/$db" "$MIRROR/$db" -name '*.dump' -mtime +$KEEP_DAYS -delete
log "backup $db OK: $(basename "$out") $size bytes, $entries tables with data"
