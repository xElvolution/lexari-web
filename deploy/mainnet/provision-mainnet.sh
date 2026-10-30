#!/usr/bin/env bash
# One-time (idempotent) setup of the separate Lexari MAINNET environment on this VPS. Run as root.
# Creates: OS user lexarimain, /opt/lexari-mainnet, Postgres role + database lexari_mainnet (PG18 :5433),
# /opt/lexari-mainnet/shared/webapp.env (mode 600) with NEW secrets, the backup script + cron, and the nginx vhost.
# Reads the testnet env only to (a) copy network-neutral settings named in SHARED_KEYS and (b) compute the guard values
# that stop mainnet from ever reusing the testnet database or session secret. Never prints a secret.
# It does not restart, reload or edit anything that belongs to the testnet (app.lexari.ai).
set -euo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
DIR=/opt/lexari-mainnet
APP_USER=lexarimain
TESTNET_ENV=/opt/lexari-web/shared/webapp.env
ENVF=$DIR/shared/webapp.env
DB=lexari_mainnet
PORT=5433
log() { echo "==> $*"; }

log "user $APP_USER"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin "$APP_USER"
# the shared Grok CLI relay socket (/run/lexari-grok) is group lexariweb
id -nG "$APP_USER" | grep -qw lexariweb || usermod -aG lexariweb "$APP_USER"

log "directories"
install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$DIR" "$DIR/releases"
install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$DIR/shared"

log "database $DB"
if ! sudo -u postgres psql -p $PORT -Atc "select 1 from pg_roles where rolname='$DB'" | grep -q 1; then
  NEWPW=$(openssl rand -hex 32)
  printf "create role %s login password '%s';\n" "$DB" "$NEWPW" | sudo -u postgres psql -p $PORT -q -v ON_ERROR_STOP=1
  echo "$NEWPW" > /root/.lexari_mainnet_dbpw && chmod 600 /root/.lexari_mainnet_dbpw
fi
sudo -u postgres psql -p $PORT -Atc "select 1 from pg_database where datname='$DB'" | grep -q 1 || sudo -u postgres createdb -p $PORT -O $DB $DB
sudo -u postgres psql -p $PORT -q -d $DB -c "revoke all on database $DB from public; revoke create on schema public from public;" >/dev/null

if [ ! -f "$ENVF" ]; then
  log "env file (new secrets)"
  [ -f /root/.lexari_mainnet_dbpw ] || { echo "the $DB role exists but its password file is missing; reset it by hand"; exit 1; }
  python3 "$SRC/make-mainnet-env.py" "$TESTNET_ENV" "$ENVF" /root/.lexari_mainnet_dbpw
  chown "$APP_USER:$APP_USER" "$ENVF"; chmod 600 "$ENVF"
  shred -u /root/.lexari_mainnet_dbpw
else
  log "env file exists; left as is"
fi

log "backups"
install -m 755 "$SRC/lexari-db-backup.sh" /usr/local/sbin/lexari-db-backup.sh
install -m 644 "$SRC/lexari-db-backup.cron" /etc/cron.d/lexari-db-backup

log "nginx vhost (own file; backup of /etc/nginx first; nginx -t before reload)"
if [ ! -e /etc/nginx/sites-available/lexari-mainnet ]; then
  tar -czf "/root/nginx-backup-$(date +%Y%m%d-%H%M%S).tgz" -C / etc/nginx
  install -m 644 "$SRC/nginx-mainnet.lexari.ai.conf" /etc/nginx/sites-available/lexari-mainnet
  ln -sfn /etc/nginx/sites-available/lexari-mainnet /etc/nginx/sites-enabled/lexari-mainnet
  if nginx -t; then systemctl reload nginx; else rm -f /etc/nginx/sites-enabled/lexari-mainnet; echo "nginx -t failed; vhost not enabled"; exit 1; fi
fi
install -m 755 "$SRC/deploy-mainnet.sh" "$DIR/deploy-mainnet.sh"
log "done. Next: $DIR/deploy-mainnet.sh"
