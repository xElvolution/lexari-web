#!/usr/bin/env bash
# Lexari MAINNET deploy for mainnet.lexari.ai. Run as root: /opt/lexari-mainnet/deploy-mainnet.sh [git-ref]
#
# Completely separate from the testnet deploy (/opt/lexari-web/deploy.sh, app.lexari.ai):
#   /opt/lexari-mainnet/repo            git clone of xElvolution/lexari-web (fetch only; default ref origin/mainnet)
#   /opt/lexari-mainnet/shared          webapp.env (mode 600, owner lexarimain), ecosystem.config.cjs
#   /opt/lexari-mainnet/releases/<sha>  one built release per commit (git worktree)
#   /opt/lexari-mainnet/current         symlink to the live release; pm2 app "lexari-mainnet-webapp" on 127.0.0.1:3212
#   database                            lexari_mainnet on the local Postgres 18 (port 5433), stamped "mainnet"
# It never touches /opt/lexari-web, the lexari database, the testnet pm2 apps or ports 3210/3211/3290/3291.
#
# A release goes live only after: own npm ci, a LEXARI_NETWORK=mainnet build, a database backup, migrations (which
# refuse a database stamped testnet) and a smoke test on :3292 that must report network "mainnet". The smoke server
# runs in its own process group and the port is checked free afterwards.
# Rollback (code only; restore the pre-deploy dump in /var/backups/lexari/lexari_mainnet for the DB):
#   deploy-mainnet.sh --rollback
set -euo pipefail
DIR=/opt/lexari-mainnet
APP_USER=lexarimain
SHARED=$DIR/shared
RELEASES=$DIR/releases
REPO=$DIR/repo
KEEP=3
PORT=3212
SMOKE=3292
PM2_NAME=lexari-mainnet-webapp
HOST=mainnet.lexari.ai
ENVF=$SHARED/webapp.env
as_app() { sudo -u "$APP_USER" -H bash -c "$*"; }
log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
envval() { sed -n "s/^$1=//p" "$ENVF" | tail -1; }

# --- guards: this script only ever deploys mainnet, into its own directory, against its own database
[ "$(readlink -f "$DIR")" != "/opt/lexari-web" ] || die "refusing: $DIR is the testnet directory"
[ -f "$ENVF" ] || die "missing $ENVF (run provision-mainnet.sh first)"
[ "$(envval LEXARI_NETWORK)" = "mainnet" ] || die "LEXARI_NETWORK must be mainnet in $ENVF"
[ -z "$(envval LEXARI_FAUCET_KEY)" ] || die "LEXARI_FAUCET_KEY must not be set on mainnet"
dbname=$(envval DATABASE_URL | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#')
[ -n "$dbname" ] && [ "$dbname" != "lexari" ] || die "DATABASE_URL must point at the mainnet database, not the testnet one"
[ "$(envval DATABASE_URL)" != "$(envval LEXARI_TESTNET_DATABASE_URL)" ] || die "DATABASE_URL equals the testnet database"

switch_to() {
  local rel=$1
  ln -sfn "$rel" "$DIR/current.new" && mv -Tf "$DIR/current.new" "$DIR/current"
  chown -h "$APP_USER:$APP_USER" "$DIR/current"
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then pm2 restart "$PM2_NAME" --update-env >/dev/null; else pm2 start "$SHARED/ecosystem.config.cjs" >/dev/null; fi
  pm2 save >/dev/null
}

if [ "${1:-}" = "--rollback" ]; then
  cur=$(readlink -f "$DIR/current")
  prev=$(ls -1dt "$RELEASES"/*/ | sed 's:/$::' | grep -vx "$cur" | head -1 || true)
  [ -n "$prev" ] || die "no previous release"
  log "rolling back to $(basename "$prev") (code only)"; switch_to "$prev"; exit 0
fi

REF=${1:-origin/mainnet}
mkdir -p "$RELEASES"; chown "$APP_USER:$APP_USER" "$RELEASES"
[ -d "$REPO/.git" ] || as_app "git clone --quiet --no-checkout https://github.com/xElvolution/lexari-web.git $REPO"

log "fetch"
as_app "cd $REPO && git fetch --quiet origin"
SHA=$(as_app "cd $REPO && git rev-parse --short=12 $REF")
REL=$RELEASES/$SHA
if [ -f "$REL/.built" ]; then
  log "release $SHA already built"
else
  rm -rf "$REL"; as_app "cd $REPO && git worktree prune && git worktree add --force --detach $REL $SHA >/dev/null"
  as_app "ln -sfn $ENVF $REL/webapp/.env.production.local"
  log "npm ci (own install; nothing is shared with the testnet tree)"
  as_app "cd $REL && npm ci --no-audit --no-fund --loglevel=error"
  log "build $SHA (LEXARI_NETWORK=mainnet)"
  as_app "cd $REL && LEXARI_NETWORK=mainnet NEXT_PUBLIC_LEXARI_NETWORK=mainnet LEXARI_BUILD=$SHA nice -n 10 npm run build -w webapp"
  as_app "touch $REL/.built"
fi

if [ "$(sudo -u postgres psql -p 5433 -d "$dbname" -Atc "select to_regclass('public.schema_migrations') is not null")" = "t" ]; then
  log "backup $dbname before migrating"
  /usr/local/sbin/lexari-db-backup.sh "$dbname" "pre-deploy-$SHA" || die "backup failed; nothing migrated, live site unchanged"
else
  log "$dbname is new and empty: nothing to back up"
fi

log "migrate"
out=$(as_app "cd $REL/webapp && LEXARI_NETWORK=mainnet node --env-file=.env.production.local server/db/migrate.mjs" 2>&1) || { echo "MIGRATION FAILED; live site unchanged"; echo "$out" | sed -E 's#postgres(ql)?://[^ ]+#<url>#g' | tail -5; exit 1; }
echo "$out" | grep -v '^skip' | sed -E 's#postgres(ql)?://[^ ]+#<url>#g' || true
echo "$out" | grep -qx "network mainnet" || die "database is not stamped mainnet"

log "smoke test on :$SMOKE"
NEXT=$REL/node_modules/next/dist/bin/next
fuser -s $SMOKE/tcp && die "port $SMOKE is busy"
as_app "cd $REL/webapp && NODE_ENV=production setsid nohup node $NEXT start -H 127.0.0.1 -p $SMOKE >/tmp/lexari-mainnet-smoke.log 2>&1 < /dev/null & echo \$! > /tmp/lexari-mainnet-smoke.pid"
stop_smoke() {
  local pid; pid=$(cat /tmp/lexari-mainnet-smoke.pid 2>/dev/null || true)
  [ -n "$pid" ] && kill -- "-$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5; do fuser -s $SMOKE/tcp || break; sleep 1; done
  fuser -s -k $SMOKE/tcp 2>/dev/null || true
}
trap stop_smoke EXIT
ok=1
for _ in $(seq 1 40); do curl -sf -o /dev/null "http://127.0.0.1:$SMOKE/signin" && break; sleep 1; done
for u in /signin /onboarding /app /integrations; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $HOST" "http://127.0.0.1:$SMOKE$u"); echo "   $u -> $c"
  case $c in 2*|3*) ;; *) ok=0 ;; esac
done
h=$(curl -s "http://127.0.0.1:$SMOKE/api/health"); echo "   health $h"
echo "$h" | grep -q '"ok":true' || ok=0
echo "$h" | grep -q '"network":"mainnet"' || ok=0
c=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$SMOKE/api/faucet"); echo "   /api/faucet -> $c"; [ "$c" = 404 ] || ok=0
stop_smoke; trap - EXIT
fuser -s $SMOKE/tcp && { echo "WARNING: something still listens on :$SMOKE"; ok=0; }
if [ $ok != 1 ]; then echo "SMOKE TEST FAILED: $SHA not deployed; live mainnet unchanged"; tail -20 /tmp/lexari-mainnet-smoke.log; exit 1; fi

log "switch mainnet live to $SHA"
install -m 644 "$REL/deploy/mainnet/ecosystem.mainnet.cjs" "$SHARED/ecosystem.config.cjs"
switch_to "$REL"
for _ in $(seq 1 30); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/api/health" && break; sleep 1; done
printf "   live :%s health -> " "$PORT"; curl -s "http://127.0.0.1:$PORT/api/health"; echo
install -m 755 "$REL/deploy/mainnet/deploy-mainnet.sh" "$DIR/deploy-mainnet.sh"

log "prune old releases (keep $KEEP)"
cur=$(readlink -f "$DIR/current")
ls -1dt "$RELEASES"/*/ | sed 's:/$::' | grep -vx "$cur" | tail -n +"$KEEP" | while read -r old; do
  as_app "cd $REPO && git worktree remove --force $old" || rm -rf "$old"
done
as_app "cd $REPO && git worktree prune"
log "done: $SHA live on :$PORT ($HOST)"
