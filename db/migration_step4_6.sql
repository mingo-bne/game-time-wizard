-- =========================================================================
-- Game Time Wizard — Migration Step 4.6
-- Cross-tool data foundation for:
--   * Game Time Wizard (rotations, ratings, comms — already built)
--   * Citipointe Team Management Tool (intake, age groups, formation)
--   * CourtSide Stats (per-play tracking, game scores)
--
-- Tier 1 additions (foundation, no real cost to add now):
--   1. seasons                                  — first-class entity
--   2. teams.season_id                          — replace text season
--   3. opponents                                — proper entity (logos, colors, history)
--   4. games.opposition_id                      — replace text opposition
--   5. games.team_score / opposition_score / result
--   6. players demographic fields               — gender, school, contact, external IDs
--
-- Tier 2 additions (Citipointe + CourtSide bridge):
--   7. player_preferences                       — per-player-per-season intake data
--   8. plays                                    — per-stat per-game (CourtSide bridge)
--   9. player_game_stats VIEW                   — derived per-player-per-game splits
--
-- Data-preserving: existing teams.season text and games.opposition text are
-- migrated to the new entities before columns are dropped.
--
-- Run AFTER schema.sql, rls.sql, migration_step3.sql, migration_step4_5.sql.
-- =========================================================================

-- =========================================================================
-- 0. Ensure RLS helper functions exist (idempotent — defensive)
-- Canonically defined in rls.sql. Redeclared here so this migration runs
-- cleanly even if rls.sql wasn't fully applied earlier.
-- =========================================================================
create or replace function current_staff()
returns staff language sql stable as $$
  select * from staff where user_id = auth.uid() limit 1;
$$;

create or replace function is_club_admin(target_club uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from staff
    where user_id = auth.uid() and club_id = target_club and is_admin = true
  );
$$;

create or replace function is_team_staff(target_team uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from team_staff ts
    join staff s on s.id = ts.staff_id
    where ts.team_id = target_team and s.user_id = auth.uid()
  );
$$;

create or replace function is_head_coach(target_team uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from team_staff ts
    join staff s on s.id = ts.staff_id
    where ts.team_id = target_team and s.user_id = auth.uid() and ts.role = 'head_coach'
  );
$$;

create or replace function in_club(target_club uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from staff
    where user_id = auth.uid() and club_id = target_club
  );
$$;

-- Drop dependent views before altering columns they reference.
-- They get recreated at the end of this migration with the new structure.
drop view if exists game_week_status;

-- =========================================================================
-- 1. SEASONS
-- =========================================================================
create table if not exists seasons (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,                      -- e.g. '2026 Winter'
  start_date  date,
  end_date    date,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_seasons_club on seasons(club_id);
-- Only one "current" season per club (partial unique index)
create unique index if not exists uniq_current_season_per_club
  on seasons(club_id) where is_current = true;

-- =========================================================================
-- 2. TEAMS — add season_id, migrate existing season text, drop column
-- =========================================================================
alter table teams add column if not exists season_id uuid references seasons(id) on delete set null;

-- Per-club: create season records for each distinct teams.season text value
do $$
declare
  v_club  uuid;
  v_name  text;
  v_season uuid;
begin
  for v_club, v_name in
    select distinct club_id, season from teams where season is not null
  loop
    insert into seasons (club_id, name, is_current)
    values (v_club, v_name, false)
    on conflict do nothing
    returning id into v_season;
    if v_season is null then
      select id into v_season from seasons where club_id = v_club and name = v_name limit 1;
    end if;
    update teams set season_id = v_season where club_id = v_club and season = v_name;
  end loop;

  -- For any team with NULL season, create / link a "Default Season" per club
  for v_club in select distinct club_id from teams where season_id is null
  loop
    select id into v_season from seasons where club_id = v_club and name = 'Default Season' limit 1;
    if v_season is null then
      insert into seasons (club_id, name, is_current) values (v_club, 'Default Season', true)
      returning id into v_season;
    end if;
    update teams set season_id = v_season where club_id = v_club and season_id is null;
  end loop;
end $$;

-- Now safe to drop the legacy text column
alter table teams drop column if exists season;

-- =========================================================================
-- 3. PLAYERS — demographic + integration fields
-- =========================================================================
alter table players add column if not exists gender             text check (gender in ('M','F','X','NA'));
alter table players add column if not exists first_year_of_play int;
alter table players add column if not exists primary_school     text;
alter table players add column if not exists phone              text;       -- player's own (older players)
alter table players add column if not exists email              text;       -- player's own
alter table players add column if not exists external_ids       jsonb not null default '{}'::jsonb;
                  -- e.g. { "basketball_connect": "12345", "fiba": "AUS-987" }
alter table players add column if not exists is_active_in_club  boolean not null default true;

-- =========================================================================
-- 4. OPPONENTS — proper entity
-- =========================================================================
create table if not exists opponents (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  name          text not null,
  logo_url      text,
  primary_color text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (club_id, name)
);
create index if not exists idx_opponents_club on opponents(club_id);
drop trigger if exists trg_opponents_updated on opponents;
create trigger trg_opponents_updated before update on opponents
  for each row execute function set_updated_at();

-- =========================================================================
-- 5. GAMES — add opposition_id, migrate, drop text. Add scores + result.
-- =========================================================================
alter table games add column if not exists opposition_id uuid references opponents(id) on delete set null;
alter table games add column if not exists team_score        int;
alter table games add column if not exists opposition_score  int;
alter table games add column if not exists result            text check (result in ('win','loss','draw','no_result','bye'));

-- Migrate existing games.opposition text into opponents entity (per club via team)
do $$
declare
  v_game uuid;
  v_club uuid;
  v_text text;
  v_opp  uuid;
begin
  for v_game, v_club, v_text in
    select g.id, t.club_id, g.opposition
    from games g
    join teams t on t.id = g.team_id
    where g.opposition is not null and g.opposition_id is null
  loop
    select id into v_opp from opponents where club_id = v_club and name = v_text limit 1;
    if v_opp is null then
      insert into opponents (club_id, name) values (v_club, v_text) returning id into v_opp;
    end if;
    update games set opposition_id = v_opp where id = v_game;
  end loop;
end $$;

alter table games drop column if exists opposition;

-- =========================================================================
-- 6. PLAYER_PREFERENCES — per-player-per-season intake (Citipointe core)
-- =========================================================================
create table if not exists player_preferences (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references players(id) on delete cascade,
  season_id           uuid not null references seasons(id) on delete cascade,
  intention_to_play   boolean,
  registration_status text check (registration_status in
                       ('registered','pending','not_registered','unknown')) default 'unknown',
  preferred_days      text[],                   -- e.g. {'Mon','Wed'}
  wants_to_play_with  uuid[],                   -- soft array of player IDs (no FK)
  preferred_coach     text,
  notes               text,
  source              text check (source in ('manual','intake_form','basketball_connect','import')) default 'manual',
  recorded_at         timestamptz not null default now(),
  recorded_by         uuid references staff(id),
  updated_at          timestamptz not null default now(),
  unique (player_id, season_id)
);
create index if not exists idx_prefs_player on player_preferences(player_id);
create index if not exists idx_prefs_season on player_preferences(season_id);
drop trigger if exists trg_prefs_updated on player_preferences;
create trigger trg_prefs_updated before update on player_preferences
  for each row execute function set_updated_at();

-- =========================================================================
-- 7. PLAYS — per-stat per-game (CourtSide bridge)
-- =========================================================================
create table if not exists plays (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references games(id) on delete cascade,
  player_id           uuid not null references players(id) on delete cascade,
  period              int not null check (period >= 1),
  seconds_into_period int,                      -- optional, for play timing
  stat_type           text not null check (stat_type in
                       ('2pt','3pt','ft','oreb','dreb','assist','steal','block','turnover','foul')),
  made                boolean,                  -- true/false for shots; null for non-shooting stats
  assist_player_id    uuid references players(id) on delete set null,
  recorded_by         uuid references staff(id),
  recorded_at         timestamptz not null default now(),
  source              text check (source in ('courtside','manual','import')) default 'manual'
);
create index if not exists idx_plays_game on plays(game_id);
create index if not exists idx_plays_player on plays(player_id);
create index if not exists idx_plays_game_player on plays(game_id, player_id);

-- =========================================================================
-- 8. PLAYER_GAME_STATS VIEW — aggregates plays into per-player-per-game splits
-- Includes only (game, player) pairs that have at least one play recorded.
-- =========================================================================
create or replace view player_game_stats as
  select
    pl.game_id,
    pl.player_id,
    p.full_name,
    -- Shooting
    sum(case when stat_type = '2pt' and made = true  then 1 else 0 end)::int as fg2_made,
    sum(case when stat_type = '2pt'                  then 1 else 0 end)::int as fg2_attempted,
    sum(case when stat_type = '3pt' and made = true  then 1 else 0 end)::int as fg3_made,
    sum(case when stat_type = '3pt'                  then 1 else 0 end)::int as fg3_attempted,
    sum(case when stat_type = 'ft'  and made = true  then 1 else 0 end)::int as ft_made,
    sum(case when stat_type = 'ft'                   then 1 else 0 end)::int as ft_attempted,
    -- Rebounds + other
    sum(case when stat_type = 'oreb'                 then 1 else 0 end)::int as oreb,
    sum(case when stat_type = 'dreb'                 then 1 else 0 end)::int as dreb,
    sum(case when stat_type in ('oreb','dreb')       then 1 else 0 end)::int as total_rebounds,
    sum(case when stat_type = 'assist'               then 1 else 0 end)::int as assists,
    sum(case when stat_type = 'steal'                then 1 else 0 end)::int as steals,
    sum(case when stat_type = 'block'                then 1 else 0 end)::int as blocks,
    sum(case when stat_type = 'turnover'             then 1 else 0 end)::int as turnovers,
    sum(case when stat_type = 'foul'                 then 1 else 0 end)::int as fouls,
    -- Computed
    (sum(case when stat_type = '2pt' and made = true then 1 else 0 end) * 2
     + sum(case when stat_type = '3pt' and made = true then 1 else 0 end) * 3
     + sum(case when stat_type = 'ft'  and made = true then 1 else 0 end) * 1)::int as points
  from plays pl
  join players p on p.id = pl.player_id
  group by pl.game_id, pl.player_id, p.full_name;

-- =========================================================================
-- 9. RLS for new tables
-- =========================================================================
alter table seasons             enable row level security;
alter table opponents           enable row level security;
alter table player_preferences  enable row level security;
alter table plays               enable row level security;

-- SEASONS — read club-wide, admin write
drop policy if exists seasons_read on seasons;
drop policy if exists seasons_write on seasons;
create policy seasons_read on seasons for select using (in_club(club_id));
create policy seasons_write on seasons for all
  using (is_club_admin(club_id))
  with check (is_club_admin(club_id));

-- OPPONENTS — read club-wide, any club staff can write (for game creation)
drop policy if exists opponents_read on opponents;
drop policy if exists opponents_write on opponents;
create policy opponents_read on opponents for select using (in_club(club_id));
create policy opponents_write on opponents for all
  using (in_club(club_id))
  with check (in_club(club_id));

-- PLAYER_PREFERENCES — read club-wide, any club staff can write (intake data)
drop policy if exists prefs_read on player_preferences;
drop policy if exists prefs_write on player_preferences;
create policy prefs_read on player_preferences for select
  using (
    exists (select 1 from players p where p.id = player_preferences.player_id and in_club(p.club_id))
  );
create policy prefs_write on player_preferences for all
  using (
    exists (select 1 from players p where p.id = player_preferences.player_id and in_club(p.club_id))
  )
  with check (
    exists (select 1 from players p where p.id = player_preferences.player_id and in_club(p.club_id))
  );

-- PLAYS — read club-wide via game→team→club, write by team_staff of game's team
drop policy if exists plays_read on plays;
drop policy if exists plays_write on plays;
create policy plays_read on plays for select
  using (
    exists (select 1 from games g
            join teams t on t.id = g.team_id
            where g.id = plays.game_id and in_club(t.club_id))
  );
create policy plays_write on plays for all
  using (
    exists (select 1 from games g where g.id = plays.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = plays.game_id and is_team_staff(g.team_id))
  );

-- =========================================================================
-- 10. Recreate game_week_status view (uses opposition_id → opponents.name)
-- =========================================================================
create or replace view game_week_status as
  select
    g.id                                                as game_id,
    g.team_id,
    g.game_date,
    g.game_time,
    g.venue,
    o.name                                              as opposition,
    g.status,
    (g.game_date - current_date)                        as days_to_game,
    exists (select 1 from comm_messages m
            where m.game_id = g.id and m.message_type = 'availability_request' and m.copied_at is not null) as availability_sent,
    exists (select 1 from comm_messages m
            where m.game_id = g.id and m.message_type = 'logistics_reminder' and m.copied_at is not null) as logistics_sent,
    exists (select 1 from comm_messages m
            where m.game_id = g.id and m.message_type = 'game_day_notice' and m.copied_at is not null)    as gameday_sent,
    exists (select 1 from rotation_plans rp where rp.game_id = g.id) as rotation_generated,
    exists (select 1 from duty_assignments d where d.game_id = g.id) as duty_assigned
  from games g
  left join opponents o on o.id = g.opposition_id
  where g.status = 'scheduled' and g.game_date >= current_date - interval '7 days';

-- =========================================================================
-- Done. Verify with:
--   select table_name from information_schema.tables
--    where table_schema='public'
--      and table_name in ('seasons','opponents','player_preferences','plays');
--   -- should return all 4
--
--   select count(*) from seasons;       -- at least 1 ("Default Season") per club
--   select column_name from information_schema.columns
--    where table_name='players' and column_name in
--          ('gender','first_year_of_play','primary_school','phone','email','external_ids','is_active_in_club');
--   -- should return all 7
--
--   select column_name from information_schema.columns
--    where table_name='games' and column_name in
--          ('opposition_id','team_score','opposition_score','result');
--   -- should return all 4
-- =========================================================================
