create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet text not null unique,
  nonce text,
  nonce_message text,
  nonce_expires timestamptz,
  referral_code text not null unique,
  referred_by uuid references users (id),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  slug text not null,
  name text not null,
  role text not null default '',
  tone text not null default '',
  look_json jsonb not null default '{}'::jsonb,
  asset text,
  agent_pda text,
  minted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  agent_id uuid references agents (id) on delete cascade,
  tag text not null default '',
  ciphertext text not null,
  iv text not null,
  content_hash text not null,
  uri text not null default '',
  onchain_pda text,
  use_count integer not null default 0,
  revoked boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  slug text not null,
  title text not null default '',
  member_slugs text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats (id) on delete cascade,
  from_id text not null,
  text text not null,
  meta_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  agent_id uuid references agents (id) on delete set null,
  prompt text not null,
  status text not null,
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists quest_progress (
  user_id uuid not null references users (id) on delete cascade,
  quest_id text not null,
  period_key text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id, period_key)
);

create table if not exists quest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references users (id) on delete cascade,
  agent_id uuid references agents (id) on delete set null,
  price_lamports bigint not null,
  mint text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists hires (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  buyer_id uuid not null references users (id) on delete cascade,
  tx text not null,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users (id) on delete cascade,
  referee_id uuid not null unique references users (id) on delete cascade,
  created_at timestamptz not null default now()
);
