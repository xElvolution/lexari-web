-- Settings > Models, Cursor style: one API key per provider, and on/off switches for each model.
-- user_model_keys: one row per person and provider. The key is AES-256-GCM encrypted (server/secretBox.ts); only its
-- last 4 characters are shown again. base_url: OpenAI only, the "Override OpenAI base URL" for compatible endpoints.
-- users.model_prefs: {"on": [...], "off": [...], "extra": [...]} model switches and models added by name.
-- The old per-model rows (user_models) are retired: anything that pointed at one goes back to the default.
create table if not exists user_model_keys (
  user_id uuid not null references users (id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini', 'xai', 'openrouter')),
  key_enc text not null,
  key_last4 text not null default '',
  base_url text,
  status text not null default 'untested' check (status in ('ok', 'failed', 'untested')),
  status_note text,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table users add column if not exists model_prefs jsonb not null default '{}'::jsonb;
update agents set model = null where model like 'byo:%';
update chats set model = null where model like 'byo:%';
update users set default_model = null where default_model like 'byo:%';
delete from user_models;
