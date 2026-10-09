-- Agent email. Additive only: two new tables.
-- agent_mailboxes: one address per agent (<local>@EMAIL_DOMAIN), how its mail is sent (as the agent, or as you via
-- Lexari with Reply-To your address) and your own address for forwarding.
-- agent_emails: every email in (received) and out (draft until you tap Send, then sent or failed). Nothing goes out
-- without your tap.
create table if not exists agent_mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  agent_slug text not null,
  local text not null,
  sender_mode text not null default 'agent' check (sender_mode in ('agent', 'user')),
  reply_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_mailboxes_user_agent unique (user_id, agent_slug),
  constraint agent_mailboxes_local unique (local)
);
create table if not exists agent_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  mailbox_id uuid not null references agent_mailboxes (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  status text not null check (status in ('received', 'draft', 'sending', 'sent', 'cancelled', 'failed')),
  kind text not null default 'mail' check (kind in ('mail', 'forward_verify')),
  from_addr text not null default '',
  from_name text not null default '',
  to_addrs text[] not null default '{}',
  cc_addrs text[] not null default '{}',
  reply_to text,
  subject text not null default '',
  text_body text not null default '',
  message_id text,
  in_reply_to text,
  provider text not null default 'mock',
  provider_id text unique,
  verify jsonb,
  convo text not null default '',
  chat_message_id text not null default '',
  error text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_emails_box on agent_emails (mailbox_id, direction, created_at desc);
create index if not exists agent_emails_user on agent_emails (user_id, created_at desc);
