-- In-app notification center and web push subscriptions.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  url text not null default '/app',
  key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists notifications_key on notifications (user_id, key);
create index if not exists notifications_user on notifications (user_id, created_at desc);

create table if not exists push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on push_subs (user_id);
