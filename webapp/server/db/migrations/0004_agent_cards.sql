-- Virtual cards, one per agent. On devnet these are TEST cards from the built-in issuer ("devnet-test").
create table if not exists agent_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  agent_key text not null,
  issuer text not null default 'devnet-test',
  external_id text,
  number text not null,
  last4 text not null,
  exp_month integer not null,
  exp_year integer not null,
  cvv text not null,
  spend_limit integer not null default 250,
  spent integer not null default 0,
  frozen boolean not null default false,
  pay_tx text not null unique,
  amount bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists agent_cards_user_agent on agent_cards (user_id, agent_key);
