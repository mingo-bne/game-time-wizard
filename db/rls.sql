-- =========================================================================
-- Game Time Wizard — Row-Level Security Policies
-- v1 — 2026-04-30
-- =========================================================================
-- Permission model:
--   READ:  any staff in the club can SELECT any row in their club's data
--   WRITE: staff can only INSERT/UPDATE/DELETE for teams they're assigned to
--   RATINGS WRITE: only Head Coach role on that team can write
--   CLUB ADMIN (staff.is_admin = true): can do anything within their club
-- =========================================================================

-- Helper: get the staff row for the current authenticated user
create or replace function current_staff()
returns staff language sql stable as $$
  select * from staff where user_id = auth.uid() limit 1;
$$;

-- Helper: is current user club admin?
create or replace function is_club_admin(target_club uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from staff
    where user_id = auth.uid()
      and club_id = target_club
      and is_admin = true
  );
$$;

-- Helper: is current user assigned to this team in any role?
create or replace function is_team_staff(target_team uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from team_staff ts
    join staff s on s.id = ts.staff_id
    where ts.team_id = target_team
      and s.user_id = auth.uid()
  );
$$;

-- Helper: is current user Head Coach of this team?
create or replace function is_head_coach(target_team uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from team_staff ts
    join staff s on s.id = ts.staff_id
    where ts.team_id = target_team
      and s.user_id = auth.uid()
      and ts.role = 'head_coach'
  );
$$;

-- Helper: is current user in this club?
create or replace function in_club(target_club uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from staff
    where user_id = auth.uid()
      and club_id = target_club
  );
$$;

-- =========================================================================
-- Enable RLS on all tables
-- =========================================================================
alter table clubs                enable row level security;
alter table staff                enable row level security;
alter table teams                enable row level security;
alter table team_staff           enable row level security;
alter table families             enable row level security;
alter table family_contacts      enable row level security;
alter table players              enable row level security;
alter table ratings              enable row level security;
alter table games                enable row level security;
alter table availabilities       enable row level security;
alter table attendances          enable row level security;
alter table coach_notes          enable row level security;
alter table duty_pool_exclusions enable row level security;
alter table duty_assignments     enable row level security;
alter table rotation_plans       enable row level security;
alter table comm_templates       enable row level security;
alter table comm_messages        enable row level security;
alter table team_memberships     enable row level security;
alter table seasons              enable row level security;
alter table opponents            enable row level security;
alter table player_preferences   enable row level security;
alter table plays                enable row level security;

-- =========================================================================
-- CLUBS
-- =========================================================================
create policy clubs_read on clubs for select
  using (in_club(id));

create policy clubs_write on clubs for all
  using (is_club_admin(id))
  with check (is_club_admin(id));

-- =========================================================================
-- STAFF — read all in same club; only admin can write
-- =========================================================================
create policy staff_read on staff for select
  using (in_club(club_id));

create policy staff_write on staff for all
  using (is_club_admin(club_id))
  with check (is_club_admin(club_id));

-- =========================================================================
-- TEAMS — read all in club; admin or assigned head coach can write
-- =========================================================================
create policy teams_read on teams for select
  using (in_club(club_id));

create policy teams_write on teams for all
  using (is_club_admin(club_id) or is_head_coach(id))
  with check (is_club_admin(club_id) or is_head_coach(id));

-- =========================================================================
-- TEAM_STAFF — read all in club; only admin manages assignments
-- =========================================================================
create policy team_staff_read on team_staff for select
  using (
    exists (
      select 1 from teams t where t.id = team_staff.team_id and in_club(t.club_id)
    )
  );

create policy team_staff_write on team_staff for all
  using (
    exists (select 1 from teams t where t.id = team_staff.team_id and is_club_admin(t.club_id))
  )
  with check (
    exists (select 1 from teams t where t.id = team_staff.team_id and is_club_admin(t.club_id))
  );

-- =========================================================================
-- FAMILIES, FAMILY_CONTACTS, PLAYERS — CLUB-LEVEL, any club staff can edit
-- =========================================================================
create policy families_read on families for select
  using (in_club(club_id));

create policy families_write on families for all
  using (in_club(club_id))
  with check (in_club(club_id));

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

create policy players_read on players for select
  using (in_club(club_id));

create policy players_write on players for all
  using (in_club(club_id))
  with check (in_club(club_id));

-- =========================================================================
-- TEAM_MEMBERSHIPS — read club-wide, write by team staff
-- =========================================================================
create policy memberships_read on team_memberships for select
  using (
    exists (select 1 from teams t where t.id = team_memberships.team_id and in_club(t.club_id))
  );

create policy memberships_write on team_memberships for all
  using (is_team_staff(team_id))
  with check (is_team_staff(team_id));

-- =========================================================================
-- RATINGS — read club-wide; write ONLY by Head Coach of THAT team
-- =========================================================================
create policy ratings_read on ratings for select
  using (
    exists (select 1 from teams t where t.id = ratings.team_id and in_club(t.club_id))
  );

create policy ratings_write on ratings for all
  using (is_head_coach(team_id))
  with check (is_head_coach(team_id));

-- =========================================================================
-- GAMES, AVAILABILITIES, ATTENDANCES, COACH_NOTES
-- Read club-wide, write by team staff
-- =========================================================================
create policy games_read on games for select
  using (
    exists (select 1 from teams t where t.id = games.team_id and in_club(t.club_id))
  );

create policy games_write on games for all
  using (is_team_staff(team_id))
  with check (is_team_staff(team_id));

create policy avail_read on availabilities for select
  using (
    exists (
      select 1 from games g
      join teams t on t.id = g.team_id
      where g.id = availabilities.game_id and in_club(t.club_id)
    )
  );

create policy avail_write on availabilities for all
  using (
    exists (select 1 from games g where g.id = availabilities.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = availabilities.game_id and is_team_staff(g.team_id))
  );

create policy attend_read on attendances for select
  using (
    exists (
      select 1 from games g
      join teams t on t.id = g.team_id
      where g.id = attendances.game_id and in_club(t.club_id)
    )
  );

create policy attend_write on attendances for all
  using (
    exists (select 1 from games g where g.id = attendances.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = attendances.game_id and is_team_staff(g.team_id))
  );

create policy notes_read on coach_notes for select
  using (
    exists (
      select 1 from games g
      join teams t on t.id = g.team_id
      where g.id = coach_notes.game_id and in_club(t.club_id)
    )
  );

create policy notes_write on coach_notes for all
  using (
    exists (select 1 from games g where g.id = coach_notes.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = coach_notes.game_id and is_team_staff(g.team_id))
  );

-- =========================================================================
-- DUTY: exclusions, assignments
-- =========================================================================
create policy excl_read on duty_pool_exclusions for select
  using (
    exists (
      select 1 from families f
      join teams t on t.id = f.team_id
      where f.id = duty_pool_exclusions.family_id and in_club(t.club_id)
    )
  );

create policy excl_write on duty_pool_exclusions for all
  using (
    exists (select 1 from families f where f.id = duty_pool_exclusions.family_id and is_team_staff(f.team_id))
  )
  with check (
    exists (select 1 from families f where f.id = duty_pool_exclusions.family_id and is_team_staff(f.team_id))
  );

create policy duty_read on duty_assignments for select
  using (
    exists (
      select 1 from games g
      join teams t on t.id = g.team_id
      where g.id = duty_assignments.game_id and in_club(t.club_id)
    )
  );

create policy duty_write on duty_assignments for all
  using (
    exists (select 1 from games g where g.id = duty_assignments.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = duty_assignments.game_id and is_team_staff(g.team_id))
  );

-- =========================================================================
-- ROTATION PLANS
-- =========================================================================
create policy rotation_read on rotation_plans for select
  using (
    exists (
      select 1 from games g
      join teams t on t.id = g.team_id
      where g.id = rotation_plans.game_id and in_club(t.club_id)
    )
  );

create policy rotation_write on rotation_plans for all
  using (
    exists (select 1 from games g where g.id = rotation_plans.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = rotation_plans.game_id and is_team_staff(g.team_id))
  );

-- =========================================================================
-- COMMS: templates and generated messages
-- Templates: club-wide read, admin-only write
-- Messages: club-wide read, team-staff write
-- =========================================================================
create policy templates_read on comm_templates for select
  using (in_club(club_id));

create policy templates_write on comm_templates for all
  using (is_club_admin(club_id))
  with check (is_club_admin(club_id));

create policy msg_read on comm_messages for select
  using (
    exists (
      select 1 from games g
      join teams t on t.id = g.team_id
      where g.id = comm_messages.game_id and in_club(t.club_id)
    )
  );

create policy msg_write on comm_messages for all
  using (
    exists (select 1 from games g where g.id = comm_messages.game_id and is_team_staff(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = comm_messages.game_id and is_team_staff(g.team_id))
  );

-- =========================================================================
-- SEASONS — read club-wide; admin-only write
-- =========================================================================
create policy seasons_read on seasons for select using (in_club(club_id));
create policy seasons_write on seasons for all
  using (is_club_admin(club_id))
  with check (is_club_admin(club_id));

-- =========================================================================
-- OPPONENTS — read club-wide; any club staff can write (used during game creation)
-- =========================================================================
create policy opponents_read on opponents for select using (in_club(club_id));
create policy opponents_write on opponents for all
  using (in_club(club_id))
  with check (in_club(club_id));

-- =========================================================================
-- PLAYER_PREFERENCES — read club-wide; any club staff can write (intake data)
-- =========================================================================
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

-- =========================================================================
-- PLAYS — read club-wide via game→team→club; write by team_staff of game's team
-- =========================================================================
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
-- END RLS
-- =========================================================================
