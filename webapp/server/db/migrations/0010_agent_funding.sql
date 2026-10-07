-- Agent wallets funded from the Lexari balance (devnet test USDC for now). Additive only: one new table.
-- direction in: balance -> agent wallet; out: agent wallet -> balance. The balance side is in credit_ledger (ref fund:<id>).
create table if not exists agent_fundings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  agent_slug text not null,
  chain text not null default 'solana',
  direction text not null check (direction in ('in', 'out')),
  asset text not null default 'USDC',
  amount_micros bigint not null,
  status text not null default 'pending',
  tx_sig text unique,
  client_key text unique,
  address text not null,
  error text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists agent_fundings_user on agent_fundings (user_id, created_at desc);
