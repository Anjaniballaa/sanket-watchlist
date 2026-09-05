-- Sanket schema. NextAuth owns public.users; app tables FK that id.
-- RLS is on so the anon key cannot read user rows. Route handlers
-- authorize via NextAuth, then write with the service_role client.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid not null default gen_random_uuid(),
  name text,
  email text,
  "emailVerified" timestamptz,
  image text,
  primary key (id)
);

create table if not exists accounts (
  id uuid not null default gen_random_uuid(),
  "userId" uuid not null,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  primary key (id),
  constraint accounts_user_fk foreign key ("userId") references users (id) on delete cascade
);

create unique index if not exists accounts_provider_idx
  on accounts (provider, "providerAccountId");

create table if not exists sessions (
  id uuid not null default gen_random_uuid(),
  expires timestamptz not null,
  "sessionToken" text not null unique,
  "userId" uuid not null,
  primary key (id),
  constraint sessions_user_fk foreign key ("userId") references users (id) on delete cascade
);

create table if not exists verification_tokens (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  ticker text not null,
  display_name text,
  sector text,
  reference_price numeric,
  muted_until timestamptz,
  added_at timestamptz default now(),
  unique(user_id, ticker)
);

create table if not exists price_snapshots (
  id bigint generated always as identity primary key,
  ticker text not null,
  price numeric not null,
  volume bigint,
  previous_close numeric,
  high_52w numeric,
  low_52w numeric,
  snapshot_window timestamptz not null,
  captured_at timestamptz default now(),
  unique (ticker, snapshot_window)
);

create index if not exists price_snapshots_ticker_time
  on price_snapshots (ticker, captured_at desc);

create table if not exists user_last_seen (
  user_id uuid not null references users(id) on delete cascade,
  ticker text not null,
  last_seen_price numeric,
  last_seen_at timestamptz,
  quiet_visit_streak int default 0,
  first_flagged_at timestamptz,
  primary key (user_id, ticker)
);

create table if not exists change_events (
  id bigint generated always as identity primary key,
  ticker text not null,
  user_id uuid references users(id) on delete cascade,
  event_type text,
  score numeric,
  summary text,
  confidence text,
  created_at timestamptz default now()
);

create table if not exists news_cache (
  id bigint generated always as identity primary key,
  ticker text not null,
  headline text,
  url text,
  published_at timestamptz,
  fetched_at timestamptz default now()
);

create index if not exists news_cache_ticker_time
  on news_cache (ticker, published_at desc);

create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  w1 numeric not null default 1.0,
  w2 numeric not null default 0.55,
  w3 numeric not null default 0.85,
  w4 numeric not null default 0.65,
  w5 numeric not null default 0.7,
  threshold numeric not null default 1.15,
  updated_at timestamptz default now()
);

create table if not exists digest_shares (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz default now()
);

alter table watchlist_items enable row level security;
alter table user_last_seen enable row level security;
alter table user_preferences enable row level security;
alter table digest_shares enable row level security;

revoke all on watchlist_items from anon, authenticated;
revoke all on user_last_seen from anon, authenticated;
revoke all on user_preferences from anon, authenticated;
revoke all on digest_shares from anon, authenticated;
revoke all on price_snapshots from anon, authenticated;
revoke all on change_events from anon, authenticated;
revoke all on news_cache from anon, authenticated;

grant all on watchlist_items to service_role;
grant all on user_last_seen to service_role;
grant all on user_preferences to service_role;
grant all on digest_shares to service_role;
grant all on price_snapshots to service_role;
grant all on change_events to service_role;
grant all on news_cache to service_role;
grant all on users to service_role;
grant all on accounts to service_role;
grant all on sessions to service_role;
grant all on verification_tokens to service_role;
