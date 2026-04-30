-- =========================================================================
-- Game Time Wizard — Postgres / Supabase Schema
-- v1 — 2026-04-30
-- =========================================================================
-- Conventions:
--   - UUID primary keys (gen_random_uuid())
--   - created_at / updated_at on every table
--   - CHECK constraints for enum-like fields
--   - All FKs use ON DELETE CASCADE within a club's data tree
--   - RLS policies live in rls.sql
-- =========================================================================

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Reusable trigger for updated_at -----------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =========================================================================
-- CORE: clubs, staff, teams, team_staff
-- =========================================================================

create table clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_clubs_updated before update on clubs
  for each row execute function set_updated_at();

-- staff = a person who logs in. Links to Supabase auth.users.
-- user_id is nullable to support "pending" staff: an admin can pre-create a
-- staff record by email; the auto_attach_staff_on_signup() trigger fills in
-- user_id when that person first signs in via magic link.
create table staff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  is_admin    boolean not null default false,  -- club-level admin (Ming)
  invited_at  timestamptz,
  attached_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_staff_club on staff(club_id);
create trigger trg_staff_updated before update on staff
  for each row execute function set_updated_at();

-- Auto-attach trigger: when a new auth.users row is created (someone signs
-- in via magic link for the first time), find any pending staff records
-- with a matching email and link them to the new auth user.
create or replace function auto_attach_staff_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update staff
     set user_id = new.id,
         attached_at = now()
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists trg_attach_staff on auth.users;
create trigger trg_attach_staff
  after insert on auth.users
  for each row execute function auto_attach_staff_on_signup();

-- Seasons are first-class — Citipointe + multi-year history rely on this.
create table seasons (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,                       -- e.g. '2026 Winter'
  start_date  date,
  end_date    date,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_seasons_club on seasons(club_id);
create unique index uniq_current_season_per_club
  on seasons(club_id) where is_current = true;

create table teams (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  season_id   uuid references seasons(id) on delete set null,
  name        text not null,
  age_group   text,                            -- e.g. 'U12', 'U16', 'Senior'
  rule_mode   text not null default 'equal_opportunity'
              check (rule_mode in ('equal_opportunity','no_engine')),
  -- Game format: defaults to 2 halves x 20 min (40 min total).
  -- Junior teams typically override to 4 periods x 8 or 10 min (quarters).
  game_format_periods           int not null default 2,
  game_format_minutes_per_period int not null default 20,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_teams_club on teams(club_id);
create index idx_teams_season on teams(season_id);
create trigger trg_teams_updated before update on teams
  for each row execute function set_updated_at();

-- team_staff = which staff are assigned to which teams, in what role
create table team_staff (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  role        text not null
              check (role in ('head_coach','assistant_coach','team_manager')),
  created_at  timestamptz not null default now(),
  unique (team_id, staff_id)
);
create index idx_teamstaff_team on team_staff(team_id);
create index idx_teamstaff_staff on team_staff(staff_id);

-- =========================================================================
-- ROSTER: families, family_contacts, players (CLUB-LEVEL),
-- team_memberships (per-team facts: jersey, positions, active)
-- =========================================================================

create table families (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  family_name text not null,                   -- e.g. 'Lu', 'Smith'
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_families_club on families(club_id);
create trigger trg_families_updated before update on families
  for each row execute function set_updated_at();

create table family_contacts (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  name          text not null,
  relationship  text,                          -- e.g. 'mother', 'father', 'guardian'
  phone         text,
  email         text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index idx_contacts_family on family_contacts(family_id);

-- Players are CLUB-LEVEL — human facts only (name, DOB, family, photo, demographics).
-- Per-team facts (jersey, positions, active) live on team_memberships.
-- Demographic + integration fields support Citipointe Team Mgmt and CourtSide Stats.
create table players (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references clubs(id) on delete cascade,
  family_id          uuid references families(id) on delete set null,
  full_name          text not null,
  dob                date,
  gender             text check (gender in ('M','F','X','NA')),
  first_year_of_play int,
  primary_school     text,
  phone              text,                       -- player's own (older players)
  email              text,                       -- player's own
  photo_url          text,
  external_ids       jsonb not null default '{}'::jsonb,
                                                 -- e.g. {"basketball_connect":"12345","fiba":"AUS-987"}
  is_active_in_club  boolean not null default true,
  notes              text,                       -- club-level notes (career, injury history)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_players_club on players(club_id);
create index idx_players_family on players(family_id);
create trigger trg_players_updated before update on players
  for each row execute function set_updated_at();

-- team_memberships = which players are on which teams in which capacity.
-- One row per (player, team) pair. Same player can be on multiple teams
-- with different jersey numbers, positions, active status.
create table team_memberships (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  jersey_no   int,
  positions   text[],                          -- e.g. {'PG','SG'} — may differ per team
  is_active   boolean not null default true,   -- inactive = stays on roster but excluded from rotations
  joined_at   date,
  left_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, team_id),                 -- one membership per pair
  unique (team_id, jersey_no)                  -- jersey unique per team (NULL allowed multiple times)
);
create index idx_memberships_team on team_memberships(team_id);
create index idx_memberships_player on team_memberships(player_id);
create trigger trg_memberships_updated before update on team_memberships
  for each row execute function set_updated_at();

-- =========================================================================
-- RATINGS: snapshot model, head coach edits only.
-- Ratings are per (player, team) — same player can carry different ratings
-- in different teams (e.g. 5/5 Speed in U14, 3/5 Speed in Senior context).
-- =========================================================================

-- Ratings: 11 sub-skills grouped into 3 categories. Each scored 1-5.
--   Physical (4):     Speed, Strength, Size, Fitness                   -> max 20
--   Core Skills (5):  Shooting, Ball Handling, Passing, Defence,
--                     Rebounding                                       -> max 25
--   Basketball IQ (2): Court Awareness, Decision Making                -> max 10
-- Total possible: 55.
create table ratings (
  id                    uuid primary key default gen_random_uuid(),
  player_id             uuid not null references players(id) on delete cascade,
  team_id               uuid not null references teams(id) on delete cascade,
  -- Physical
  phy_speed             int not null check (phy_speed             between 1 and 5),
  phy_strength          int not null check (phy_strength          between 1 and 5),
  phy_size              int not null check (phy_size              between 1 and 5),
  phy_fitness           int not null check (phy_fitness           between 1 and 5),
  -- Core Skills
  cs_shooting           int not null check (cs_shooting           between 1 and 5),
  cs_ball_handling      int not null check (cs_ball_handling      between 1 and 5),
  cs_passing            int not null check (cs_passing            between 1 and 5),
  cs_defence            int not null check (cs_defence            between 1 and 5),
  cs_rebounding         int not null check (cs_rebounding         between 1 and 5),
  -- Basketball IQ
  iq_court_awareness    int not null check (iq_court_awareness    between 1 and 5),
  iq_decision_making    int not null check (iq_decision_making    between 1 and 5),
  -- Meta
  rated_by              uuid references staff(id),
  rated_at              timestamptz not null default now(),
  notes                 text,
  updated_at            timestamptz not null default now(),
  unique (player_id, team_id)                                  -- one rating per pair
);
create index idx_ratings_team on ratings(team_id);
create trigger trg_ratings_updated before update on ratings
  for each row execute function set_updated_at();

-- Player balance score view: shows BOTH sum and average per category, per team.
-- Used by the rotation engine for on-court 5 balancing and by the ratings UI.
create or replace view player_balance_score as
  select
    p.id              as player_id,
    p.club_id,
    r.team_id,
    p.full_name,
    -- Physical
    (r.phy_speed + r.phy_strength + r.phy_size + r.phy_fitness)::int                                  as physical_sum,
    round((r.phy_speed + r.phy_strength + r.phy_size + r.phy_fitness)::numeric / 4.0, 2)              as physical_avg,
    -- Core Skills
    (r.cs_shooting + r.cs_ball_handling + r.cs_passing + r.cs_defence + r.cs_rebounding)::int        as core_skills_sum,
    round((r.cs_shooting + r.cs_ball_handling + r.cs_passing + r.cs_defence + r.cs_rebounding)::numeric / 5.0, 2) as core_skills_avg,
    -- Basketball IQ
    (r.iq_court_awareness + r.iq_decision_making)::int                                                as basketball_iq_sum,
    round((r.iq_court_awareness + r.iq_decision_making)::numeric / 2.0, 2)                            as basketball_iq_avg,
    -- Total
    (r.phy_speed + r.phy_strength + r.phy_size + r.phy_fitness
     + r.cs_shooting + r.cs_ball_handling + r.cs_passing + r.cs_defence + r.cs_rebounding
     + r.iq_court_awareness + r.iq_decision_making)::int                                              as total_sum,
    round((r.phy_speed + r.phy_strength + r.phy_size + r.phy_fitness
     + r.cs_shooting + r.cs_ball_handling + r.cs_passing + r.cs_defence + r.cs_rebounding
     + r.iq_court_awareness + r.iq_decision_making)::numeric / 11.0, 2)                               as total_avg
  from players p
  left join ratings r on r.player_id = p.id;

-- =========================================================================
-- SCHEDULE: games
-- =========================================================================

-- Opponents are club-level entities — supports logos, primary colors, and
-- season-on-season head-to-head analysis.
create table opponents (
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
create index idx_opponents_club on opponents(club_id);
create trigger trg_opponents_updated before update on opponents
  for each row execute function set_updated_at();

create table games (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references teams(id) on delete cascade,
  opposition_id     uuid references opponents(id) on delete set null,
  game_date         date not null,
  game_time         time,
  venue             text,
  court             text,
  -- Override format if non-standard for this game (null = use team default)
  periods             int,
  minutes_per_period  int,
  status            text not null default 'scheduled'
                    check (status in ('scheduled','completed','cancelled','bye')),
  team_score        int,
  opposition_score  int,
  result            text check (result in ('win','loss','draw','no_result','bye')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_games_team on games(team_id);
create index idx_games_date on games(team_id, game_date);
create trigger trg_games_updated before update on games
  for each row execute function set_updated_at();

-- =========================================================================
-- AVAILABILITY (pre-game) and ATTENDANCE (post-game)
-- =========================================================================

create table availabilities (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  status        text not null
                check (status in ('available','unavailable','injured','tentative')),
  confirmed_at  timestamptz,
  confirmed_by  uuid references staff(id),
  notes         text,
  unique (game_id, player_id)
);
create index idx_avail_game on availabilities(game_id);

create table attendances (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  status      text not null
              check (status in ('present','late','no_show','excused')),
  recorded_by uuid references staff(id),
  recorded_at timestamptz not null default now(),
  unique (game_id, player_id)
);
create index idx_attend_game on attendances(game_id);

create table coach_notes (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  note        text not null,
  authored_by uuid references staff(id),
  created_at  timestamptz not null default now()
);
create index idx_notes_game on coach_notes(game_id);

-- =========================================================================
-- BENCH DUTY
-- =========================================================================

create table duty_pool_exclusions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  exclusion_type text not null
                 check (exclusion_type in ('one_off','partial','full_season')),
  date_from   date,                              -- null = open-ended
  date_to     date,                              -- null = open-ended
  reason      text,
  created_at  timestamptz not null default now()
);
create index idx_excl_family on duty_pool_exclusions(family_id);

create table duty_assignments (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  generated_at  timestamptz not null default now(),
  generated_by  uuid references staff(id),
  is_locked     boolean not null default false,  -- prevents regen overwriting confirmed assignments
  unique (game_id)                                -- one duty family per game per team
);
create index idx_duty_game on duty_assignments(game_id);
create index idx_duty_family on duty_assignments(family_id);

-- =========================================================================
-- ROTATION PLANS
-- =========================================================================

create table rotation_plans (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null unique references games(id) on delete cascade,
  -- Plan stored as JSONB: { "periods": [ { "minute_blocks": [ { "from":0, "to":2.5, "on_court":[player_ids] }, ... ] }, ... ] }
  plan          jsonb not null,
  generated_at  timestamptz not null default now(),
  generated_by  uuid references staff(id),
  is_locked     boolean not null default false,
  notes         text
);
create index idx_rotation_game on rotation_plans(game_id);

-- =========================================================================
-- COMMS: templates and generated messages
-- =========================================================================

create table comm_templates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  message_type text not null
               check (message_type in ('availability_request','logistics_reminder','game_day_notice')),
  template    text not null,
  updated_at  timestamptz not null default now(),
  unique (club_id, message_type)
);
create trigger trg_templates_updated before update on comm_templates
  for each row execute function set_updated_at();

create table comm_messages (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  message_type  text not null
                check (message_type in ('availability_request','logistics_reminder','game_day_notice')),
  generated_text text not null,
  generated_at  timestamptz not null default now(),
  generated_by  uuid references staff(id),
  copied_at     timestamptz,                     -- marked when user clicks "copy to clipboard"
  unique (game_id, message_type)
);
create index idx_msg_game on comm_messages(game_id);

-- =========================================================================
-- HELPER VIEW: game_week_status
-- One row per upcoming game showing which workflow steps are done.
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
-- PLAYER PREFERENCES (Citipointe intake — per player per season)
-- =========================================================================
create table player_preferences (
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
create index idx_prefs_player on player_preferences(player_id);
create index idx_prefs_season on player_preferences(season_id);
create trigger trg_prefs_updated before update on player_preferences
  for each row execute function set_updated_at();

-- =========================================================================
-- PLAYS (CourtSide bridge — per-stat per-game event log)
-- =========================================================================
create table plays (
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
create index idx_plays_game on plays(game_id);
create index idx_plays_player on plays(player_id);
create index idx_plays_game_player on plays(game_id, player_id);

-- Aggregated per-player-per-game stats (derived view, not a table).
-- CourtSide writes plays → this view returns shooting splits + counts.
create or replace view player_game_stats as
  select
    pl.game_id,
    pl.player_id,
    p.full_name,
    sum(case when stat_type = '2pt' and made = true  then 1 else 0 end)::int as fg2_made,
    sum(case when stat_type = '2pt'                  then 1 else 0 end)::int as fg2_attempted,
    sum(case when stat_type = '3pt' and made = true  then 1 else 0 end)::int as fg3_made,
    sum(case when stat_type = '3pt'                  then 1 else 0 end)::int as fg3_attempted,
    sum(case when stat_type = 'ft'  and made = true  then 1 else 0 end)::int as ft_made,
    sum(case when stat_type = 'ft'                   then 1 else 0 end)::int as ft_attempted,
    sum(case when stat_type = 'oreb'                 then 1 else 0 end)::int as oreb,
    sum(case when stat_type = 'dreb'                 then 1 else 0 end)::int as dreb,
    sum(case when stat_type in ('oreb','dreb')       then 1 else 0 end)::int as total_rebounds,
    sum(case when stat_type = 'assist'               then 1 else 0 end)::int as assists,
    sum(case when stat_type = 'steal'                then 1 else 0 end)::int as steals,
    sum(case when stat_type = 'block'                then 1 else 0 end)::int as blocks,
    sum(case when stat_type = 'turnover'             then 1 else 0 end)::int as turnovers,
    sum(case when stat_type = 'foul'                 then 1 else 0 end)::int as fouls,
    (sum(case when stat_type = '2pt' and made = true then 1 else 0 end) * 2
     + sum(case when stat_type = '3pt' and made = true then 1 else 0 end) * 3
     + sum(case when stat_type = 'ft'  and made = true then 1 else 0 end) * 1)::int as points
  from plays pl
  join players p on p.id = pl.player_id
  group by pl.game_id, pl.player_id, p.full_name;

-- =========================================================================
-- END SCHEMA
-- =========================================================================
