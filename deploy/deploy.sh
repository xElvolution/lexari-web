#!/usr/bin/env bash
# Lexari zero-downtime deploy. Run as root: /opt/lexari-web/deploy.sh [git-ref]
#
# Layout on the server:
#   /opt/lexari-web               git checkout (source of releases; fetch only)
#   /opt/lexari-web/shared        landing.env, webapp.env (mode 600), ecosystem.config.cjs
#   /opt/lexari-web/releases/<sha> one built release per commit (git worktree)
#   /opt/lexari-web/current       symlink to the live release; pm2 runs from here
#
# A release goes live only after install, build, migrations and a smoke test on spare ports pass.
# The live site keeps serving the previous release the whole time. Rollback: deploy.sh --rollback
set -euo pipefail
DIR=/opt/lexari-web
APP_USER=lexariweb
SHARED=$DIR/shared
RELEASES=$DIR/releases
KEEP=3
SMOKE_LANDING=3290
SMOKE_WEBAPP=3291
as_app() { sudo -u "$APP_USER" -H bash -c "$*"; }
log() { echo "==> $*"; }

switch_to() {
  local rel=$1
  ln -sfn "$rel" "$DIR/current.new" && mv -Tf "$DIR/current.new" "$DIR/current"
  chown -h "$APP_USER:$APP_USER" "$DIR/current"
  if pm2 describe lexari-webapp 2>/dev/null | grep -q "exec cwd.*$DIR/current/webapp"; then
    pm2 restart lexari-webapp lexari-landing --update-env
  else
    pm2 delete lexari-landing lexari-webapp >/dev/null 2>&1 || true
    pm2 start "$SHARED/ecosystem.config.cjs"
  fi
  pm2 save >/dev/null
}

if [ "${1:-}" = "--rollback" ]; then
  cur=$(readlink -f "$DIR/current")
  prev=$(ls -1dt "$RELEASES"/*/ | sed 's:/$::' | grep -vx "$cur" | head -1 || true)
  [ -n "$prev" ] || { echo "no previous release"; exit 1; }
  log "rolling back to $(basename "$prev")"; switch_to "$prev"; exit 0
fi

REF=${1:-origin/main}
cd "$DIR"
mkdir -p "$SHARED" "$RELEASES"; chown "$APP_USER:$APP_USER" "$RELEASES"
# one-time: move env files into shared/
for app in landing webapp; do
  if [ ! -e "$SHARED/$app.env" ] && [ -f "$DIR/$app/.env.production.local" ]; then install -m 600 -o "$APP_USER" -g "$APP_USER" "$DIR/$app/.env.production.local" "$SHARED/$app.env"; fi
done
grep -qx "releases/" .git/info/exclude 2>/dev/null || printf 'releases/\nshared/\ncurrent\ndeploy.sh\necosystem.config.cjs\n' >> .git/info/exclude

log "fetch"
as_app "cd $DIR && git fetch --quiet origin"
SHA=$(as_app "cd $DIR && git rev-parse --short=12 $REF")
REL=$RELEASES/$SHA
if [ -f "$REL/.built" ]; then
  log "release $SHA already built"
else
  rm -rf "$REL"; as_app "cd $DIR && git worktree prune && git worktree add --force --detach $REL $SHA >/dev/null"
  for app in landing webapp; do as_app "ln -sfn $SHARED/$app.env $REL/$app/.env.production.local"; done
  PREV=$(readlink -f "$DIR/current" 2>/dev/null || true)
  [ -n "$PREV" ] && [ -d "$PREV" ] || PREV=$DIR
  if [ -n "$PREV" ] && [ -d "$PREV/node_modules" ] && cmp -s "$PREV/package-lock.json" "$REL/package-lock.json"; then
    log "dependencies unchanged; linking node_modules from $(basename "$PREV")"
    as_app "cp -al $PREV/node_modules $REL/node_modules"
    for app in landing webapp shared; do [ -d "$PREV/$app/node_modules" ] && as_app "cp -al $PREV/$app/node_modules $REL/$app/node_modules"; done
  else
    log "npm ci"; as_app "cd $REL && npm ci --no-audit --no-fund --loglevel=error"
  fi
  log "build $SHA"; as_app "cd $REL && npm run build"
  as_app "touch $REL/.built"
fi

log "migrate"
out=$(as_app "cd $REL/webapp && node --env-file=.env.production.local server/db/migrate.mjs") || { echo "MIGRATION FAILED; live site unchanged"; echo "$out" | sed -E 's#postgres(ql)?://[^ ]+#<url>#g' | tail -5; exit 1; }
echo "$out" | grep -v '^skip' || true

log "smoke test on :$SMOKE_LANDING / :$SMOKE_WEBAPP"
NEXT=$REL/node_modules/next/dist/bin/next
as_app "cd $REL/landing && NODE_ENV=production nohup node $NEXT start -H 127.0.0.1 -p $SMOKE_LANDING >/tmp/lexari-smoke-landing.log 2>&1 & echo \$! > /tmp/lexari-smoke-landing.pid"
as_app "cd $REL/webapp && NODE_ENV=production nohup node $NEXT start -H 127.0.0.1 -p $SMOKE_WEBAPP >/tmp/lexari-smoke-webapp.log 2>&1 & echo \$! > /tmp/lexari-smoke-webapp.pid"
stop_smoke() { kill "$(cat /tmp/lexari-smoke-landing.pid)" "$(cat /tmp/lexari-smoke-webapp.pid)" 2>/dev/null || true; }
trap stop_smoke EXIT
ok=1
for i in $(seq 1 30); do curl -sf -o /dev/null "http://127.0.0.1:$SMOKE_WEBAPP/signin" && curl -sf -o /dev/null "http://127.0.0.1:$SMOKE_LANDING/" && break; sleep 1; done
for u in "$SMOKE_LANDING/" "$SMOKE_WEBAPP/signin" "$SMOKE_WEBAPP/onboarding" "$SMOKE_WEBAPP/app"; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: app.lexari.ai" "http://127.0.0.1:$u"); echo "   $u -> $c"
  case $c in 2*|3*) ;; *) ok=0 ;; esac
done
h=$(curl -s "http://127.0.0.1:$SMOKE_WEBAPP/api/health"); echo "   health $h"
echo "$h" | grep -q '"database":true' || ok=0
stop_smoke; trap - EXIT
if [ $ok != 1 ]; then echo "SMOKE TEST FAILED: $SHA not deployed; live site unchanged"; tail -20 /tmp/lexari-smoke-webapp.log; exit 1; fi

log "switch live to $SHA"
install -m 644 "$REL/deploy/ecosystem.config.cjs" "$SHARED/ecosystem.config.cjs"
switch_to "$REL"
sleep 2
for p in 3210 3211; do printf "   live :%s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:$p/" || true; done
install -m 755 "$REL/deploy/deploy.sh" "$DIR/deploy.sh" 2>/dev/null || true

log "prune old releases (keep $KEEP)"
cur=$(readlink -f "$DIR/current")
ls -1dt "$RELEASES"/*/ | sed 's:/$::' | grep -vx "$cur" | tail -n +"$KEEP" | while read -r old; do
  as_app "cd $DIR && git worktree remove --force $old" || rm -rf "$old"
done
as_app "cd $DIR && git worktree prune"
log "done: $SHA live"
