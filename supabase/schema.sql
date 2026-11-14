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
  id        bigint generated always as identity primary key,
  name      text not null,
  name_key  text generated always as (lower(trim(name))) stored unique
);

-- One row per finished game. The date is filled in automatically.
-- This is the only place scores are kept.
create table if not exists public.games (
  id         bigint generated always as identity primary key,
  player_id  bigint not null references public.players (id) on delete cascade,
  score      integer not null check (score between 0 and 397),  -- 397 = a full 20x20 board
  played_at  timestamptz not null default now()
);

-- Each player's games, best first: used by the leaderboard
-- and by the "new personal best" check
create index if not exists games_player_best_idx
  on public.games (player_id, score desc, played_at asc);


-- ---------------------------------------------------------
-- Clean up older versions of this file
-- Earlier versions also stored each player's best score, game
-- count and dates on the players table, with a trigger to keep
-- them in sync. Scores now live only in the games table, so
-- those are removed. (Does nothing on a fresh database.)
-- ---------------------------------------------------------

drop trigger  if exists games_changed on public.games;
drop function if exists public.games_changed();
drop function if exists public.refresh_player_stats(bigint);
drop index    if exists public.players_leaderboard_idx;
drop index    if exists public.games_leaderboard_idx;
drop index    if exists public.games_player_score_idx;
alter table public.players
  drop column if exists best_score,
  drop column if exists best_score_at,
  drop column if exists games_played,
  drop column if exists first_seen_at,
  drop column if exists last_played_at;

-- Recreated below (in case a different version of it exists)
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

  -- The "do update" changes nothing; it's there so the existing
  -- player's id is returned (their original spelling is kept)
  insert into players (name) values (v_name)
  on conflict (name_key) do update set name = players.name
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
  if p_score is null or p_score < 0 or p_score > 397 then
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

  return p_score > v_old_best;
end;
$$;

-- Top players by best score, one row per player.
-- Ties go to whoever reached the score first.
create function public.get_leaderboard(p_limit integer default 5)
returns table (name text, best_score integer, best_score_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select name, best_score, best_score_at
  from (
    -- each player's best game (the earliest, if they hit the same score twice)
    select distinct on (g.player_id)
           p.name, g.score as best_score, g.played_at as best_score_at
    from games g
    join players p on p.id = g.player_id
    order by g.player_id, g.score desc, g.played_at asc
  ) best
  order by best_score desc, best_score_at asc
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
