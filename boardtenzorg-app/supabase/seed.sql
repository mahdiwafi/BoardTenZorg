-- BoardTenZorg minimal schema + seed to support the Next.js app.
-- Run once after creating the Supabase project (psql, Supabase SQL editor, or `supabase db push`).

-- Extensions ----------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- Custom types ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'season_status') then
    create type season_status as enum ('active', 'finalized');
  end if;

  if not exists (select 1 from pg_type where typname = 'tournament_state') then
    create type tournament_state as enum ('registered', 'rated');
  end if;
end $$;

-- Core tables ----------------------------------------------------------------
create table if not exists public.users (
  id char(5) primary key,
  auth_user_id uuid unique not null,
  username text unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_roles (
  auth_user_id uuid primary key references public.users(auth_user_id) on delete cascade,
  role text not null check (role in ('admin', 'player')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.seasons (
  id text primary key,
  status season_status not null default 'active',
  start_at timestamptz not null default timezone('Asia/Jakarta', date_trunc('month', now())),
  end_at timestamptz,
  k_factor int not null default 32
);

create table if not exists public.player_season_ratings (
  user_id char(5) not null references public.users(id) on delete cascade,
  season_id text not null references public.seasons(id) on delete cascade,
  rating_current int not null default 1000,
  matches_played int not null default 0,
  first_reached_current_rating_at timestamptz default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, season_id)
);

create table if not exists public.leaderboard_snapshots (
  season_id text not null references public.seasons(id) on delete cascade,
  user_id char(5) not null references public.users(id) on delete cascade,
  final_rank int not null,
  final_rating int not null,
  matches_played int not null,
  captured_at timestamptz not null default timezone('utc', now()),
  primary key (season_id, user_id)
);

create table if not exists public.tournaments (
  id uuid primary key default uuid_generate_v4(),
  season_id text not null references public.seasons(id) on delete cascade,
  challonge_url text not null,
  challonge_slug text,
  name text not null,
  state tournament_state not null default 'registered',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id char(5) not null references public.users(id) on delete cascade,
  challonge_participant_id bigint,
  challonge_display_name text,
  registered_at timestamptz not null default timezone('utc', now()),
  primary key (tournament_id, user_id)
);

create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  challonge_match_id bigint unique not null,
  p1_user_id char(5) not null references public.users(id),
  p2_user_id char(5) not null references public.users(id),
  winner_user_id char(5) not null references public.users(id),
  scores_csv text not null,
  winner_points int not null,
  loser_points int not null,
  score_diff int not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rating_events (
  id uuid primary key default uuid_generate_v4(),
  season_id text not null references public.seasons(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id char(5) not null references public.users(id) on delete cascade,
  rating_before int not null,
  rating_after int not null,
  delta int not null,
  k_factor int not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes --------------------------------------------------------------------
create index if not exists idx_player_season_ratings_board
  on public.player_season_ratings (season_id, rating_current desc, matches_played desc, first_reached_current_rating_at asc);

create index if not exists idx_rating_events_user_season
  on public.rating_events (user_id, season_id, created_at desc);

create index if not exists idx_matches_tournament_time
  on public.matches (tournament_id, completed_at asc);

-- Helper function for sticky self row ----------------------------------------
create or replace function public.player_rank_for_season(
  season_id_input text,
  user_id_input char(5)
)
returns table (
  rank int,
  user_id char(5),
  username text,
  rating_current int,
  matches_played int
)
language sql
stable
set search_path = public
as $$
  select
    ranked.rank,
    ranked.user_id,
    u.username,
    ranked.rating_current,
    ranked.matches_played
  from (
    select
      psr.user_id,
      psr.rating_current,
      psr.matches_played,
      row_number() over (
        partition by psr.season_id
        order by psr.rating_current desc,
                 psr.matches_played desc,
                 coalesce(psr.first_reached_current_rating_at, timezone('utc', now())) asc
      ) as rank
    from public.player_season_ratings psr
    where psr.season_id = season_id_input
  ) ranked
  join public.users u on u.id = ranked.user_id
  where ranked.user_id = user_id_input;
$$;

-- Row Level Security ---------------------------------------------------------
alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.seasons enable row level security;
alter table public.player_season_ratings enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.matches enable row level security;
alter table public.rating_events enable row level security;

-- Public read-only access for leaderboard-facing tables.
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Public read players' and tablename = 'player_season_ratings'
  ) then
    create policy "Public read players" on public.player_season_ratings
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Public read seasons' and tablename = 'seasons'
  ) then
    create policy "Public read seasons" on public.seasons
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Public read tournaments' and tablename = 'tournaments'
  ) then
    create policy "Public read tournaments" on public.tournaments
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Public read tournament players' and tablename = 'tournament_players'
  ) then
    create policy "Public read tournament players" on public.tournament_players
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Public read matches' and tablename = 'matches'
  ) then
    create policy "Public read matches" on public.matches
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'Public read rating events' and tablename = 'rating_events'
  ) then
    create policy "Public read rating events" on public.rating_events
      for select using (true);
  end if;
end $$;

-- Authenticated users manage their own profile row.
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Users upsert self' and tablename = 'users'
  ) then
    create policy "Users upsert self" on public.users
      for insert
      with check (auth.uid() = auth_user_id);
    create policy "Users update self" on public.users
      for update using (auth.uid() = auth_user_id);
  end if;
end $$;

-- Public lookup of usernames (leaderboard display).
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Public read users' and tablename = 'users'
  ) then
    create policy "Public read users" on public.users
      for select using (true);
  end if;
end $$;

-- Authenticated users can see their own roles.
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Users read own roles' and tablename = 'user_roles'
  ) then
    create policy "Users read own roles" on public.user_roles
      for select
      using (auth.uid() = auth_user_id);
  end if;
end $$;

-- Allow players to create their initial season ratings row.
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Players seed ratings' and tablename = 'player_season_ratings'
  ) then
    create policy "Players seed ratings" on public.player_season_ratings
      for insert
      with check (
        auth.uid() = (
          select auth_user_id from public.users where id = player_season_ratings.user_id
        )
      );
  end if;
end $$;

-- Authenticated players can view/insert their own tournament registrations.
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Players register for tournaments' and tablename = 'tournament_players'
  ) then
    create policy "Players register for tournaments" on public.tournament_players
      for insert
      with check (auth.uid() = (select auth_user_id from public.users where id = user_id));
    create policy "Players update registrations" on public.tournament_players
      for update
      using (auth.uid() = (select auth_user_id from public.users where id = user_id));
  end if;
end $$;

-- Admin/service role policies (service role bypasses RLS by default).
-- Optional: allow admins (role stored in user_roles) to insert/update tournaments.
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Admins manage tournaments' and tablename = 'tournaments'
  ) then
    create policy "Admins manage tournaments" on public.tournaments
      for all using (
        auth.uid() in (
          select auth_user_id from public.user_roles where role = 'admin'
        )
      )
      with check (
        auth.uid() in (
          select auth_user_id from public.user_roles where role = 'admin'
        )
      );
  end if;
end $$;

-- Seed data ------------------------------------------------------------------
-- Create an initial season for the current month if none exists.
insert into public.seasons (id, status, start_at)
select to_char(timezone('Asia/Jakarta', now()), 'YYYY-MM') as season_id,
       'active'::season_status,
       date_trunc('month', timezone('Asia/Jakarta', now()))
where not exists (
  select 1 from public.seasons where status = 'active'
);

-- OPTIONAL: seed an admin record (replace with your email or remove if not needed).
-- 1. Ensure the Supabase Auth user exists (sign up via the app or Supabase dashboard).
-- 2. Replace the placeholder UUID/email below.
-- insert into public.users (id, auth_user_id, username)
-- values ('ADMIN', '00000000-0000-0000-0000-000000000000', 'admin')
-- on conflict (id) do nothing;
--
-- insert into public.user_roles (auth_user_id, role)
-- values ('00000000-0000-0000-0000-000000000000', 'admin')
-- on conflict (auth_user_id) do update set role = excluded.role;

-- Notes ----------------------------------------------------------------------
-- - Supabase Auth manages credentials via auth.users. Tie them to public.users through auth_user_id.
-- - The `tournament-rate` edge function should run with the service role key, so it can bypass RLS.
-- - Call `player_rank_for_season(season_id, user_id)` from the API to fetch the sticky row.
