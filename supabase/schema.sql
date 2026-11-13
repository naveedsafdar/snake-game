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
  best_score     integer not null default 0,
  best_score_at  timestamptz,                         -- when the best score was set
  games_played   integer not null default 0,
  first_seen_at  timestamptz not null default now(),  -- when they first entered their name
  last_played_at timestamptz not null default now()
);

-- One row per finished game. The date is filled in automatically.
create table if not exists public.games (
  id         bigint generated always as identity primary key,
  player_id  bigint not null references public.players (id) on delete cascade,
  score      integer not null check (score between 0 and 397),  -- 397 = a full 20x20 board
  played_at  timestamptz not null default now()
);

create index if not exists players_leaderboard_idx
  on public.players (best_score desc, best_score_at asc);


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

-- Save a finished game. The player's best score and game count are
-- updated automatically by the trigger further down.
-- Returns true when this game is a new personal best.
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

  -- Lock the player row so two games finishing at once can't clash
  select best_score into v_old_best
  from players where id = p_player_id
  for update;

  if not found then
    raise exception 'Unknown player';
  end if;

  insert into games (player_id, score) values (p_player_id, p_score);
  update players set last_played_at = now() where id = p_player_id;

  return p_score > v_old_best;
end;
$$;

-- Top players by best score (earliest to reach a score wins a tie).
create or replace function public.get_leaderboard(p_limit integer default 5)
returns table (name text, best_score integer, best_score_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select name, best_score, best_score_at
  from players
  where games_played > 0
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


-- ---------------------------------------------------------
-- Keep each player's totals in sync with the games table
--
-- The games table is the source of truth. Whenever a game is
-- added, edited or deleted (by the game OR by hand in the
-- Supabase dashboard), the player's best_score, best_score_at
-- and games_played are recalculated from their games.
-- ---------------------------------------------------------

-- Recalculate one player's totals from their games
create or replace function public.refresh_player_stats(p_player_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update players set
    games_played  = (select count(*) from games where player_id = p_player_id),
    best_score    = coalesce((select max(score) from games where player_id = p_player_id), 0),
    -- date of the first game that reached the best score
    best_score_at = (select played_at from games
                     where player_id = p_player_id
                     order by score desc, played_at asc
                     limit 1)
  where id = p_player_id;
$$;

-- Runs after every change to the games table
create or replace function public.games_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform refresh_player_stats(old.player_id);
  else
    perform refresh_player_stats(new.player_id);
    -- a game moved to a different player: fix the old player too
    if tg_op = 'UPDATE' and old.player_id <> new.player_id then
      perform refresh_player_stats(old.player_id);
    end if;
  end if;
  return null;
end;
$$;

create or replace trigger games_changed
  after insert or update or delete on public.games
  for each row execute function public.games_changed();

-- Bring every player up to date now (fixes any earlier hand edits)
select public.refresh_player_stats(id) from public.players;

-- These two are internal: the web page must not be able to call them.
revoke all on function public.refresh_player_stats(bigint) from public, anon, authenticated;
revoke all on function public.games_changed()              from public, anon, authenticated;


-- Only these functions are callable from the web page.
revoke all on function public.register_player(text)          from public;
revoke all on function public.submit_score(bigint, integer)  from public;
revoke all on function public.get_leaderboard(integer)       from public;
revoke all on function public.get_stats()                    from public;

grant execute on function public.register_player(text)         to anon, authenticated;
grant execute on function public.submit_score(bigint, integer) to anon, authenticated;
grant execute on function public.get_leaderboard(integer)      to anon, authenticated;
grant execute on function public.get_stats()                   to anon, authenticated;
