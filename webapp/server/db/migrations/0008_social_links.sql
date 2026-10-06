-- Social accounts (X, Discord, Telegram) linked through Privy and verified on the server.
-- One social account belongs to one Lexari account at a time.
create table if not exists social_links (
  user_id uuid not null references users (id) on delete cascade,
  provider text not null check (provider in ('twitter', 'discord', 'telegram')),
  subject text not null,
  handle text,
  privy_did text,
  rewardable boolean not null default false,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);
create unique index if not exists social_links_provider_subject on social_links (provider, subject);

-- Every social account that has ever been linked. Never deleted (the user link is cleared when an account is deleted),
-- so the same X, Discord or Telegram account cannot earn the link reward twice by moving between Lexari accounts.
create table if not exists social_seen (
  provider text not null,
  subject text not null,
  first_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (provider, subject)
);
