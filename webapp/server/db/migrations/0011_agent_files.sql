-- Files in chat: what an agent sends from its computer (a script, a CSV, an edited image) and what you upload to it.
-- Additive only: one new table. Bytes live here (capped per file and per person) and are served only to their owner.
create table if not exists agent_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  source text not null check (source in ('agent', 'upload', 'generated')),
  agent_slug text not null default '',
  convo text not null default '',
  message_id text not null default '',
  name text not null,
  mime text not null,
  size integer not null,
  path text not null default '',
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_files_user on agent_files (user_id, created_at desc);
