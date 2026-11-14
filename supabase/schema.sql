-- =========================================================
-- Snake: database setup for Supabase
--
-- How to use: in your Supabase project open "SQL Editor",
-- paste this whole file, and click "Run". Safe to run again.
-- =========================================================


-- ---------------------------------------------------------
-- Tables
-- ---------------------------------------------------------

-- One row per player. Names are matched ignoring case and
-- extra spaces, so "Naveed" and " naveed " are the same player.
create table if not exists public.players (
  id             bigint generated always as identity primary key,
  name           text not null,
  name_key       text generated always as (lower(trim(name))) stored unique,
  first_seen_at  timestamptz not null default now(),  -- when they first entered their name
  last_played_at timestamptz not null default now()
);

-- One row per finished game. The date is filled in automatically.
-- This is the only place scores are kept.
create table if not exists public.games (
  id         bigint generated always as identity primary key,
  player_id  bigint not null references public.players (id) on delete cascade,
  score      integer not null check (score between 0 and 794),  -- 794 = a full 20x20 board of healthy food
  played_at  timestamptz not null default now()
);

-- Highest possible score: a full 20x20 board (397 foods) all healthy at
-- 2 points each = 794. Older versions allowed only up to 397, so update
-- the limit on an existing table too.
alter table public.games drop constraint if exists games_score_check;
alter table public.games add constraint games_score_check check (score between 0 and 794);

-- Fast leaderboard (highest scores first)
create index if not exists games_leaderboard_idx
  on public.games (score desc, played_at asc);

-- Fast "is this a new personal best?" check
create index if not exists games_player_score_idx
  on public.games (player_id, score desc);


-- ---------------------------------------------------------
-- Clean up older versions of this file
-- Earlier versions kept each player's best score and game
-- count on the players table, with a trigger to keep them in
-- sync. Scores now live only in the games table, so those
-- are removed. (Does nothing on a fresh database.)
-- ---------------------------------------------------------

drop trigger  if exists games_changed on public.games;
drop function if exists public.games_changed();
drop function if exists public.refresh_player_stats(bigint);
drop index    if exists public.players_leaderboard_idx;
alter table public.players
  drop column if exists best_score,
  drop column if exists best_score_at,
  drop column if exists games_played;

-- The leaderboard now returns different columns, which
-- "create or replace" can't change, so remove the old one first.
drop function if exists public.get_leaderboard(integer);


-- ---------------------------------------------------------
-- Security
-- Row Level Security is on and there are no policies, so the
-- public key in the web page cannot read or change the tables
-- directly. It can only call the four functions below.
-- ---------------------------------------------------------

alter table public.players enable row level security;
alter table public.games   enable row level security;


-- ---------------------------------------------------------
-- Functions the game calls
-- ---------------------------------------------------------

-- Create the player if new, otherwise return the existing one.
create or replace function public.register_player(p_name text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_id   bigint;
begin
  if v_name is null or length(v_name) < 1 or length(v_name) > 20 then
    raise exception 'Name must be 1 to 20 characters';
  end if;

  insert into players (name) values (v_name)
  on conflict (name_key) do update set last_played_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Save a finished game.
-- Returns true when this game is a new personal best
-- (a player's first game always counts as one).
create or replace function public.submit_score(p_player_id bigint, p_score integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_best integer;
begin
  if p_score is null or p_score < 0 or p_score > 794 then
    raise exception 'Invalid score';
  end if;

  -- Lock the player row so two games finishing at once can't
  -- both claim a new personal best
  perform 1 from players where id = p_player_id for update;
  if not found then
    raise exception 'Unknown player';
  end if;

  -- Best score before this game (-1 when they have no games yet)
  select coalesce(max(score), -1) into v_old_best
  from games where player_id = p_player_id;

  insert into games (player_id, score) values (p_player_id, p_score);
  update players set last_played_at = now() where id = p_player_id;

  return p_score > v_old_best;
end;
$$;

-- Top single games. A player can appear more than once.
-- Ties go to whoever got the score first.
create function public.get_leaderboard(p_limit integer default 5)
returns table (name text, score integer, played_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.name, g.score, g.played_at
  from games g
  join players p on p.id = g.player_id
  order by g.score desc, g.played_at asc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Totals shown on the home screen.
create or replace function public.get_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_games',   (select count(*) from games),
    'total_players', (select count(*) from players)
  );
$$;


-- Only these functions are callable from the web page.
revoke all on function public.register_player(text)          from public;
revoke all on function public.submit_score(bigint, integer)  from public;
revoke all on function public.get_leaderboard(integer)       from public;
revoke all on function public.get_stats()                    from public;

grant execute on function public.register_player(text)         to anon, authenticated;
grant execute on function public.submit_score(bigint, integer) to anon, authenticated;
grant execute on function public.get_leaderboard(integer)      to anon, authenticated;
grant execute on function public.get_stats()                   to anon, authenticated;
