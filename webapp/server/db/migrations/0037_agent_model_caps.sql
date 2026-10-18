-- Per-agent model caps: the most an agent's chats may bill in one billing cycle (micro dollars). No row = no cap.
create table if not exists agent_model_caps (
  user_id uuid not null references users(id) on delete cascade,
  agent_slug text not null,
  cycle_micros bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_slug),
  constraint agent_model_caps_range check (cycle_micros between 0 and 500000000)
);
create index if not exists usage_ledger_user_agent_at on usage_ledger (user_id, agent_slug, created_at);
