-- Secrets vault: API keys, tokens and passwords people save through the secure card (never through chat).
-- value_enc is AES-256-GCM sealed (server/secretBox.ts) with the user id and row id bound in as associated data.
create table if not exists user_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  label text not null default '',
  service text not null default '',
  value_enc text not null,
  last4 text not null default '',
  agents text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, name)
);
-- An agent asking for a credential: the chat shows a secure card until it's saved or cancelled.
create table if not exists secret_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent text not null,
  convo text not null,
  message_id text not null,
  name text not null,
  label text not null default '',
  service text not null default '',
  why text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists secret_requests_user_idx on secret_requests (user_id, created_at desc);
