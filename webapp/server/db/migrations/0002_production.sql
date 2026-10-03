-- 0002: server-side account state, chain ledger, verified hires, shared rate limits.
-- Idempotent, so it is safe on a database that already ran parts of it.

alter table users add column if not exists privy_did text;
alter table users add column if not exists email text;
alter table users add column if not exists profile jsonb not null default '{}'::jsonb;
alter table users add column if not exists prefs jsonb not null default '{}'::jsonb;
create unique index if not exists users_privy_did on users (privy_did) where privy_did is not null;

alter table agents add column if not exists kind text not null default 'home';
alter table agents add column if not exists about text not null default '';
alter table agents add column if not exists skills jsonb not null default '[]'::jsonb;
alter table agents add column if not exists memory_on boolean not null default true;
alter table agents add column if not exists meta jsonb not null default '{}'::jsonb;
alter table agents add column if not exists updated_at timestamptz not null default now();
create unique index if not exists agents_asset on agents (asset) where asset is not null;

alter table memories add column if not exists source text not null default '';
alter table memories add column if not exists chain_tx text;

alter table chats add column if not exists updated_at timestamptz not null default now();
alter table messages add column if not exists client_id text;
create index if not exists messages_chat_created on messages (chat_id, created_at);
create unique index if not exists messages_client_id on messages (chat_id, client_id) where client_id is not null;

alter table jobs add column if not exists assignee text not null default 'home';
alter table jobs add column if not exists title text not null default '';
alter table jobs add column if not exists output text not null default '';
alter table jobs add column if not exists error text;
alter table jobs add column if not exists created_at timestamptz not null default now();
create index if not exists jobs_user_created on jobs (user_id, created_at);

-- Quest events can point at what caused them (a tx signature, a job id) and carry a number (a level).
alter table quest_events add column if not exists ref text;
alter table quest_events add column if not exists amount integer not null default 0;
create unique index if not exists quest_events_kind_ref on quest_events (user_id, kind, ref) where ref is not null;
create index if not exists quest_events_user_kind_created on quest_events (user_id, kind, created_at);

-- Every Lexari instruction we have seen confirmed onchain, once.
create table if not exists chain_ledger (
  signature text not null,
  ix_index integer not null,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  amount bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  slot bigint,
  created_at timestamptz not null default now(),
  primary key (signature, ix_index)
);
create index if not exists chain_ledger_user_kind on chain_ledger (user_id, kind, created_at);

-- Hires: Lexari's house specialists, paid to the treasury. One payment, one hire.
alter table hires alter column listing_id drop not null;
alter table hires add column if not exists slug text not null default '';
alter table hires add column if not exists mint text not null default 'SOL';
alter table hires add column if not exists amount bigint not null default 0;
alter table hires add column if not exists payer text not null default '';
create unique index if not exists hires_tx on hires (tx);
create unique index if not exists hires_buyer_slug on hires (buyer_id, slug) where slug <> '';

create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
