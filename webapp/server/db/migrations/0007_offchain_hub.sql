-- Coins, streaks, levels and claims live in the database (no Solana transactions for the Hub).
-- Each person's row is seeded once from their onchain Player/Level accounts so nobody loses coins.
create table if not exists hub_players (
  user_id uuid primary key references users (id) on delete cascade,
  coins bigint not null default 0,
  lifetime bigint not null default 0,
  streak integer not null default 0,
  last_check_in bigint not null default 0,
  cosmetics jsonb not null default '{}'::jsonb,
  seeded_from text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists hub_levels (
  user_id uuid not null references users (id) on delete cascade,
  slug text not null,
  level integer not null default 1,
  xp integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);
-- One row per reward that can only be taken once (quest:<id>:<period>, box:<day>, tier:<i>, checkin:<day>, store:<item>).
create table if not exists hub_claims (
  user_id uuid not null references users (id) on delete cascade,
  key text not null,
  coins integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
