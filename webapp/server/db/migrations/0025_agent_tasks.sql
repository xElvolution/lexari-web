-- Agent abilities: long work on the agent's computer and recurring tasks. Additive only.
-- kind: meeting (join, record, transcribe, summarise), job (a long command), schedule (a recurring instruction),
--   video, deploy (jobs with a result file / link).
-- status: running | waiting | done | failed | stopped (one-off work); active | paused (schedules).
-- job_id: the job on the desktop relay (~/.lexari/jobs/<job_id>). state: the latest status the job reported.
create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  agent text not null default 'home',
  convo text not null default 'home',
  kind text not null,
  status text not null,
  title text not null default '',
  spec jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  result text,
  job_id text,
  next_run timestamptz,
  last_run timestamptz,
  runs integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint agent_tasks_kind check (kind in ('meeting', 'job', 'schedule', 'video', 'deploy')),
  constraint agent_tasks_status check (status in ('running', 'waiting', 'done', 'failed', 'stopped', 'active', 'paused'))
);
create index if not exists agent_tasks_user on agent_tasks (user_id, created_at desc);
create index if not exists agent_tasks_open on agent_tasks (status) where status in ('running', 'waiting', 'active');
