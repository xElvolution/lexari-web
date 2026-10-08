-- Settings > Integrations. Additive only: two new tables.
-- integration_grants: an integration a person added, which of their agents may use it, and its limits (whole dollars,
-- basis points). An empty agent list means no agent can use it yet.
-- integration_actions: every action an agent took or prepared with an integration (reads too), with its status, the
-- dollar value counted against the limits, and the transaction signature once it is on chain.
create table if not exists integration_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  connector text not null,
  enabled boolean not null default true,
  agent_slugs text[] not null default '{}',
  per_tx_usd integer not null default 5,
  daily_usd integer not null default 20,
  max_slippage_bps integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_grants_user_connector unique (user_id, connector),
  constraint integration_grants_limits check (per_tx_usd between 1 and 25 and daily_usd between 1 and 100 and daily_usd >= per_tx_usd and max_slippage_bps between 10 and 500)
);
create table if not exists integration_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  connector text not null,
  tool text not null,
  agent_slug text not null,
  chain text not null default '',
  convo text not null default '',
  message_id text not null default '',
  input jsonb not null default '{}'::jsonb,
  preview jsonb,
  usd_micros bigint not null default 0,
  status text not null check (status in ('done', 'prepared', 'rejected', 'cancelled', 'expired', 'submitting', 'submitted', 'confirmed', 'failed')),
  error text,
  tx_sig text unique,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists integration_actions_user on integration_actions (user_id, created_at desc);
create index if not exists integration_actions_user_connector on integration_actions (user_id, connector, created_at desc);
