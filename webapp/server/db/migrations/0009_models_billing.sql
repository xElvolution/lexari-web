-- Models and billing (Lamina, premium models, plans in USD, extra credits, card and USDC payments).
-- Additive only: new tables and nullable columns. Money is stored in micro dollars (USD x 1e6).

-- Which model answers. null on a chat = use the agent's model; null on an agent = Lamina.
alter table agents add column if not exists model text;
alter table chats add column if not exists model text;

-- A plan purchase can start later than it was bought (a renewal, or a smaller plan after a bigger one ends).
alter table plan_purchases add column if not exists starts_at timestamptz;
alter table plan_purchases add column if not exists payment_id uuid;

-- One row per billing cycle: the two included pools and what was used from them and from extra credits.
create table if not exists usage_periods (
  user_id uuid not null references users (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  plan text not null,
  lamina_limit_micros bigint not null default 0,
  lamina_used_micros bigint not null default 0,
  premium_limit_micros bigint not null default 0,
  premium_used_micros bigint not null default 0,
  credits_used_micros bigint not null default 0,
  primary key (user_id, period_start)
);

-- Reservations placed before a model call and settled (or released) after it.
create table if not exists usage_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  pool text not null,
  micros bigint not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists usage_holds_user on usage_holds (user_id, expires_at);

-- Every metered turn: what was asked for, what answered, tokens, real cost and what was billed.
create table if not exists usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  convo text not null default '',
  agent_slug text not null default '',
  kind text not null default 'chat',
  pool text not null,
  requested_model text not null,
  served_model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  cost_micros bigint not null default 0,
  billed_micros bigint not null default 0,
  lamina_micros bigint not null default 0,
  premium_micros bigint not null default 0,
  credits_micros bigint not null default 0,
  estimated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists usage_ledger_user_time on usage_ledger (user_id, created_at desc);

-- Extra credits balance (cached sum of credit_ledger) and the monthly spend limit on them.
create table if not exists billing_settings (
  user_id uuid primary key references users (id) on delete cascade,
  credit_micros bigint not null default 0,
  spend_mode text not null default 'fixed',
  spend_limit_micros bigint not null default 25000000,
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  delta_micros bigint not null,
  reason text not null,
  ref text unique,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user on credit_ledger (user_id, created_at desc);

-- Payments to Lexari on either rail (card through a provider, or USDC on Solana). Granted once, by the entitlements service.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  rail text not null check (rail in ('card', 'crypto')),
  provider text not null,
  product text not null check (product in ('plan', 'credits')),
  sku text not null,
  amount_minor bigint not null,
  currency text not null,
  status text not null default 'pending',
  provider_ref text unique,
  tx_sig text unique,
  reference text unique,
  payer text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz
);
create index if not exists payments_user on payments (user_id, created_at desc);
