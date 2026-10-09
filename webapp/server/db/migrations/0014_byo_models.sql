-- Settings > Models. Additive only: one new table and one nullable column.
-- user_models: models a person added with their own API key. The key is AES-256-GCM encrypted (server/secretBox.ts);
-- only its last 4 characters are ever shown again.
-- users.default_model: the account default for agents without a model of their own (null = Lamina).
create table if not exists user_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'xai', 'openrouter', 'custom')),
  label text not null default '',
  model text not null,
  base_url text,
  key_enc text not null,
  key_last4 text not null default '',
  status text not null default 'untested' check (status in ('ok', 'failed', 'untested')),
  status_note text,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_models_user on user_models (user_id, created_at);
alter table users add column if not exists default_model text;
