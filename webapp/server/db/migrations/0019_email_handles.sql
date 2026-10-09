-- Agent email addresses without random letters: <agent>.<your email name>@agents.lexari.ai, e.g. rika.elvolution.
-- users.email_handle: your email name, shared by all your agents and unique across Lexari. It starts as your first name
-- and you can choose your own once (email_handle_chosen). agent_mailboxes.agent_part: the agent's name part, unique per
-- person (a second agent with the same name gets a number). An address is filled in on next open (local null until then).
-- Old addresses with a random 4-character tag are all cleared here, so they get the new address.
alter table users add column if not exists email_handle text;
alter table users add column if not exists email_handle_chosen boolean not null default false;
create unique index if not exists users_email_handle on users (email_handle) where email_handle is not null;
alter table agent_mailboxes add column if not exists agent_part text;
alter table agent_mailboxes alter column local drop not null;
create unique index if not exists agent_mailboxes_user_part on agent_mailboxes (user_id, agent_part) where agent_part is not null;
update agent_mailboxes set local = null, updated_at = now() where agent_part is null;
