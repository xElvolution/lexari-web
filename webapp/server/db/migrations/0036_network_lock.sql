-- One row naming the network this database belongs to ("mainnet" or "testnet"). Stamped by the first migration run
-- or server start (server/network.ts); a server in the other mode refuses to use the database.
create table if not exists lexari_network (
  id smallint primary key default 1 check (id = 1),
  network text not null check (network in ('mainnet', 'testnet')),
  stamped_at timestamptz not null default now()
);
