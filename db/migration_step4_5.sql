-- =========================================================================
-- Game Time Wizard — Migration Step 4.5
-- Restructure: players + families become CLUB-LEVEL.
-- New table team_memberships holds per-team jersey/positions/active.
-- Ratings become per (player, team) so the same player can carry different
-- ratings in different teams.
-- =========================================================================
--
-- ⚠️ DESTRUCTIVE: this drops players, families, family_contacts, ratings,
-- availabilities, attendances, coach_notes and rebuilds them.
-- Confirmed safe to run because no real player data exists yet.
--
-- Run this AFTER schema.sql, rls.sql, migration_step3.sql.
-- =========================================================================

-- 0. Ensure RLS helper functions exist (idempotent — defensive).
-- These are canonically defined in rls.sql; redeclaring them here means this
-- migration runs cleanly even if rls.sql wasn't fully applied earlier.
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

-- 1. Drop dependent objects (CASCADE handles FK references)
drop view if exists player_balance_score;

drop table if exists ratings        cascade;
drop table if exists availabilities cascade;
drop table if exists attendances    cascade;
drop table if exists coach_notes    cascade;
drop table if exists players        cascade;
drop table if exists family_contacts cascade;
drop table if exists families       cascade;

-- =========================================================================
-- 2. Recreate FAMILIES (now club-level)
-- =========================================================================
create table families (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  family_name text not null,
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
  relationship  text,
  phone         text,
  email         text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index idx_contacts_family on family_contacts(family_id);

-- =========================================================================
-- 3. Recreate PLAYERS (now club-level — human-level facts only)
-- =========================================================================
create table players (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  family_id   uuid references families(id) on delete set null,
  full_name   text not null,
  dob         date,
  photo_url   text,
  notes       text,                                     -- club-level notes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_players_club on players(club_id);
create index idx_players_family on players(family_id);
create trigger trg_players_updated before update on players
  for each row execute function set_updated_at();

-- =========================================================================
-- 4. NEW: team_memberships — per-team facts (jersey, positions, active)
-- =========================================================================
create table team_memberships (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  jersey_no   int,
  positions   text[],
  is_active   boolean not null default true,
  joined_at   date,
  left_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, team_id),                           -- one membership per pair
  unique (team_id, jersey_no)                            -- jersey unique per team (NULL allowed multiple times)
);
create index idx_memberships_team on team_memberships(team_id);
create index idx_memberships_player on team_memberships(player_id);
create trigger trg_memberships_updated before update on team_memberships
  for each row execute function set_updated_at();

-- =========================================================================
-- 5. Recreate RATINGS (now per (player, team) — team-specific ratings)
-- =========================================================================
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
  rated_by              uuid references staff(id),
  rated_at              timestamptz not null default now(),
  notes                 text,
  updated_at            timestamptz not null default now(),
  unique (player_id, team_id)                            -- one rating per pair
);
create index idx_ratings_team on ratings(team_id);
create trigger trg_ratings_updated before update on ratings
  for each row execute function set_updated_at();

-- =========================================================================
-- 6. Recreate per-game data tables (availabilities, attendances, coach_notes)
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
-- 7. Recreate player_balance_score view — now keyed by (player, team)
-- =========================================================================
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
-- 8. RLS policies for the rebuilt tables
-- =========================================================================
alter table families         enable row level security;
alter table family_contacts  enable row level security;
alter table players          enable row level security;
alter table team_memberships enable row level security;
alter table ratings          enable row level security;
alter table availabilities   enable row level security;
alter table attendances      enable row level security;
alter table coach_notes      enable row level security;

-- FAMILIES (club-level: any club staff can read+write)
create policy families_read on families for select
  using (in_club(club_id));
create policy families_write on families for all
  using (in_club(club_id))
  with check (in_club(club_id));

-- FAMILY CONTACTS
create policy contacts_read on family_contacts for select
  using (
    exists (select 1 from families f where f.id = family_contacts.family_id and in_club(f.club_id))
  );
create policy contacts_write on family_contacts for all
  using (
    exists (select 1 from families f where f.id = family_contacts.family_id and in_club(f.club_id))
  )
  with check (
    exists (select 1 from families f where f.id = family_contacts.family_id and in_club(f.club_id))
  );

-- PLAYERS (club-level: any club staff can read+write)
create policy players_read on players for select
  using (in_club(club_id));
create policy players_write on players for all
  using (in_club(club_id))
  with check (in_club(club_id));

-- TEAM MEMBERSHIPS (per-team: read club-wide, write by team staff)
create policy memberships_read on team_memberships for select
  using (
    exists (select 1 from teams t where t.id = team_memberships.team_id and in_club(t.club_id))
  );
create policy memberships_write on team_memberships for all
  using (is_team_staff(team_id))
  with check (is_team_staff(team_id));

-- RATINGS (per-team: read club-wide, write only by Head Coach of THAT team)
create policy ratings_read on ratings for select
  using (
    exists (select 1 from teams t where t.id = ratings.team_id and in_club(t.club_id))
  );
create policy ratings_write on ratings for all
  using (is_head_coach(team_id))
  with check (is_head_coach(team_id));

-- AVAILABILITIES (per-game)
create policy avail_read on availabilities for select
  using (
    exists (select 1 from games g
            join teams t on t.id = g.team_id
            where g.id = availabilities.game_id and in_club(t.club_id))
  );
create policy avail_write on availabilities for all
  using (
    exists (select 1 from games g where g.id = availabilities.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = availabilities.game_id and is_team_staff(g.team_id))
  );

-- ATTENDANCES (per-game)
create policy attend_read on attendances for select
  using (
    exists (select 1 from games g
            join teams t on t.id = g.team_id
            where g.id = attendances.game_id and in_club(t.club_id))
  );
create policy attend_write on attendances for all
  using (
    exists (select 1 from games g where g.id = attendances.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = attendances.game_id and is_team_staff(g.team_id))
  );

-- COACH NOTES (per-game)
create policy notes_read on coach_notes for select
  using (
    exists (select 1 from games g
            join teams t on t.id = g.team_id
            where g.id = coach_notes.game_id and in_club(t.club_id))
  );
create policy notes_write on coach_notes for all
  using (
    exists (select 1 from games g where g.id = coach_notes.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = coach_notes.game_id and is_team_staff(g.team_id))
  );

-- =========================================================================
-- Done. Verify with:
--   select table_name from information_schema.tables
--    where table_schema='public' and table_name in
--          ('players','families','family_contacts','team_memberships',
--           'ratings','availabilities','attendances','coach_notes');
--   -- should return all 8
-- =========================================================================
