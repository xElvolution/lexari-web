-- Plans paid on devnet, the devnet SOL faucet, the app lock PIN, and profile pictures.
create table if not exists plan_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  plan text not null,
  tx text not null unique,
  amount bigint not null default 0,
  payer text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists plan_purchases_user on plan_purchases (user_id, expires_at desc);

create table if not exists faucet_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  wallet text not null,
  tx text not null,
  lamports bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists faucet_grants_user on faucet_grants (user_id);
create index if not exists faucet_grants_wallet on faucet_grants (wallet);

alter table users add column if not exists lock_hash text;
alter table users add column if not exists lock_creds jsonb not null default '[]'::jsonb;

create table if not exists user_media (
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  mime text not null,
  data bytea not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
