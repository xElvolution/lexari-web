-- Agent budgets and x402 payments. Additive only.
-- agent_budgets: how much each agent may spend on its own (per task and per day, micro dollars). Within it, the agent
--   pays services and other agents without asking; over it, you get a Confirm card.
-- x402_receipts: every x402 payment Lexari's own paid services accepted, one row per Solana signature (no replays).
create table if not exists agent_budgets (
  user_id uuid not null references users (id) on delete cascade,
  agent_slug text not null,
  per_task_micros bigint not null default 500000,
  daily_micros bigint not null default 2000000,
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_slug),
  constraint agent_budgets_sane check (per_task_micros between 0 and 25000000 and daily_micros between 0 and 100000000 and daily_micros >= per_task_micros)
);
create table if not exists x402_receipts (
  sig text primary key,
  service text not null,
  payer text not null,
  amount_atoms bigint not null,
  created_at timestamptz not null default now()
);
