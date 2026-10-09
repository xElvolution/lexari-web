-- Account protection for money actions (Settings > Security).
-- sessions: device details for "Where you're signed in", last activity, and a short step-up window (re-confirmed with
--   your PIN or a wallet signature) that high-risk actions need.
-- user_security: anti-phishing phrase, daily send cap, the confirm threshold for agent sends, allowlist-only sends.
-- address_book: saved send addresses; a first-time address gets a warning, and allowlist-only blocks the rest.
-- security_events: sign-ins and security changes, shown in Settings > Security (and as a bell notification).
alter table sessions add column if not exists created_at timestamptz not null default now();
alter table sessions add column if not exists last_seen_at timestamptz not null default now();
alter table sessions add column if not exists user_agent text not null default '';
alter table sessions add column if not exists ip_hint text not null default '';
alter table sessions add column if not exists device text not null default '';
alter table sessions add column if not exists stepup_until timestamptz;
create index if not exists sessions_user on sessions (user_id);

create table if not exists user_security (
  user_id uuid primary key references users (id) on delete cascade,
  phrase text not null default '',
  daily_send_cap_usd integer not null default 100,
  allowlist_only boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists address_book (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  chain text not null,
  address text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, chain, address)
);

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  detail text not null default '',
  device text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists security_events_user on security_events (user_id, created_at desc);
