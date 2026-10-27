-- People's names: a full name, a unique username and what agents call them (defaults to the first name).
-- Agents address people by these, never by an email address. Accounts without a full name and username are asked
-- for them on their next visit.

alter table users add column if not exists full_name text check (full_name is null or char_length(full_name) between 1 and 60);
alter table users add column if not exists username text check (username is null or username ~ '^[a-z0-9_.]{3,20}$');
alter table users add column if not exists call_name text check (call_name is null or char_length(call_name) between 1 and 30);
create unique index if not exists users_username_unique on users (username) where username is not null;

-- Carry over names people already typed (never one that is an email address).
update users set full_name = left(btrim(profile->>'name'), 60)
  where full_name is null and btrim(coalesce(profile->>'name', '')) not in ('', 'You') and profile->>'name' not like '%@%';
update users u set username = p.un from (
  select id, lower(btrim(profile->>'username')) as un,
         row_number() over (partition by lower(btrim(profile->>'username')) order by created_at) as rn
  from users where lower(btrim(coalesce(profile->>'username', ''))) ~ '^[a-z0-9_.]{3,20}$'
) p where u.id = p.id and p.rn = 1 and u.username is null;

-- What the home agent was told to call you, unless it is an email address (the old sign-in default for Google).
update users u set call_name = left(btrim(a.meta->>'you'), 30) from agents a
  where a.user_id = u.id and a.slug = 'home' and u.call_name is null
    and btrim(coalesce(a.meta->>'you', '')) <> '' and a.meta->>'you' not like '%@%';
update agents set meta = meta - 'you' where slug = 'home' and meta->>'you' like '%@%';
