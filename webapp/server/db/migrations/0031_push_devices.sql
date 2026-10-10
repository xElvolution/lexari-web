-- Expo push tokens for the Android app. Web push_subs is unchanged.
create table if not exists push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null default 'android',
  model text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_devices_user on push_devices (user_id);
