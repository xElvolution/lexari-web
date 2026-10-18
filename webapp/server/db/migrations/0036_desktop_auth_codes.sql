-- Desktop sign-in handoff: one-time codes the system browser hands to the Lexari desktop app via lexari://.
-- Only a hash of each code is stored. Codes live 60 seconds and are deleted on first use.
create table if not exists desktop_auth_codes (
  code_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists desktop_auth_codes_expires on desktop_auth_codes (expires_at);
