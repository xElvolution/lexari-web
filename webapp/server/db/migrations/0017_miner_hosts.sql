-- ORE Miner: servers people connect themselves (mining never runs on Lexari's machines). Additive only.
-- miner_hosts: one row per connected server. install_hash is a one-time code (30 min) the install script trades for
--   the long-lived host token (token_hash). Only hashes are stored.
-- miner_commands: what the person (or the ORE Miner agent) asked the server to do; the host agent polls for them.
create table if not exists miner_hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null default 'My server',
  install_hash text unique,
  install_expires timestamptz,
  token_hash text unique,
  report jsonb,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists miner_hosts_user on miner_hosts (user_id);
create table if not exists miner_commands (
  id bigserial primary key,
  host_id uuid not null references miner_hosts (id) on delete cascade,
  cmd text not null,
  args jsonb not null default '{}'::jsonb,
  state text not null default 'queued',
  output text,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  constraint miner_commands_cmd check (cmd in ('install', 'start', 'stop', 'status', 'uninstall')),
  constraint miner_commands_state check (state in ('queued', 'sent', 'done', 'failed'))
);
create index if not exists miner_commands_host on miner_commands (host_id, state);
