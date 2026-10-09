-- Top up with any coin (content/topup.ts). Additive only.
-- topup_watches: a person's deposit address for one coin on one chain, and how much of what it holds was credited.
--   Amounts are base units (numeric, so 18-decimal tokens fit). Crediting moves credited_atoms up to the confirmed
--   balance under a row lock, so the same coins are never credited twice.
-- topup_xrp_tags: each person's XRP Ledger destination tag (unique).
-- topup_credits: every crypto top-up credited (deposits and Solana wallet payments), for history and audits.
create table if not exists topup_watches (
  user_id uuid not null references users (id) on delete cascade,
  rail text not null,
  address text not null,
  credited_atoms numeric(78, 0) not null default 0,
  seen_atoms numeric(78, 0) not null default 0,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, rail)
);
create sequence if not exists topup_xrp_tag_seq start 100001;
create table if not exists topup_xrp_tags (
  user_id uuid primary key references users (id) on delete cascade,
  tag bigint not null unique default nextval('topup_xrp_tag_seq'),
  created_at timestamptz not null default now()
);
create table if not exists topup_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  rail text not null,
  atoms numeric(78, 0) not null,
  usd_micros bigint not null,
  price double precision not null,
  ref text not null unique,
  tx text,
  created_at timestamptz not null default now()
);
create index if not exists topup_credits_user on topup_credits (user_id, created_at desc);
