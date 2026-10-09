-- Agent abilities: websites an agent builds on its computer, published as a preview at app.lexari.ai/p/<id>/. Additive only.
-- One row per site (slug unique per person, so re-publishing keeps the same link) and one row per file.
create table if not exists agent_sites (
  id text primary key,
  user_id uuid not null references users (id) on delete cascade,
  agent text not null default 'home',
  slug text not null,
  name text not null default '',
  files integer not null default 0,
  bytes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_sites_user_slug unique (user_id, slug)
);
create table if not exists agent_site_files (
  site_id text not null references agent_sites (id) on delete cascade,
  path text not null,
  mime text not null,
  data bytea not null,
  primary key (site_id, path)
);
