-- Deleting an account must not be blocked by friends who joined with its code.
alter table users drop constraint if exists users_referred_by_fkey;
alter table users add constraint users_referred_by_fkey foreign key (referred_by) references users (id) on delete set null;
