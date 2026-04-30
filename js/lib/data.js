// =====================================================================
// Game Time Wizard — Data layer
// Thin wrappers around Supabase calls. Each function throws on error so
// callers can use try/catch.
// =====================================================================

window.GTWData = (function () {

  function sb() {
    if (!window._gtw_supabase) {
      window._gtw_supabase = window.supabase.createClient(
        window.GTW_CONFIG.SUPABASE_URL,
        window.GTW_CONFIG.SUPABASE_ANON
      );
    }
    return window._gtw_supabase;
  }

  function check(result) {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  // ---------- CURRENT USER / STAFF / CLUB ----------

  async function getCurrentStaff() {
    // Returns the staff row for the currently signed-in user (or null if none)
    const { data: { user } } = await sb().auth.getUser();
    if (!user) return null;
    const { data, error } = await sb()
      .from('staff')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function getClub(clubId) {
    return check(await sb().from('clubs').select('*').eq('id', clubId).single());
  }

  async function updateClub(clubId, fields) {
    return check(await sb().from('clubs').update(fields).eq('id', clubId).select().single());
  }

  // ---------- STAFF ----------

  async function listStaff(clubId) {
    return check(await sb()
      .from('staff')
      .select('*')
      .eq('club_id', clubId)
      .order('is_admin', { ascending: false })
      .order('full_name')
    );
  }

  async function createPendingStaff(clubId, fields) {
    // Pre-create a staff row with user_id = null. Trigger will attach
    // user_id when this person signs in via magic link for the first time.
    return check(await sb().from('staff').insert({
      club_id:    clubId,
      full_name:  fields.full_name,
      email:      fields.email,
      is_admin:   !!fields.is_admin,
      invited_at: new Date().toISOString()
    }).select().single());
  }

  async function updateStaff(staffId, fields) {
    return check(await sb().from('staff').update(fields).eq('id', staffId).select().single());
  }

  async function removeStaff(staffId) {
    return check(await sb().from('staff').delete().eq('id', staffId));
  }

  // ---------- TEAMS ----------

  async function listTeams(clubId) {
    return check(await sb()
      .from('teams')
      .select('*')
      .eq('club_id', clubId)
      .order('name')
    );
  }

  async function getTeam(teamId) {
    return check(await sb().from('teams').select('*').eq('id', teamId).single());
  }

  async function createTeam(clubId, fields) {
    // Auto-fill season_id with current season if none provided
    let seasonId = fields.season_id || null;
    if (!seasonId) {
      const current = await getCurrentSeason(clubId);
      seasonId = current?.id || null;
    }
    return check(await sb().from('teams').insert({
      club_id: clubId,
      season_id: seasonId,
      name: fields.name,
      age_group: fields.age_group || null,
      gender:    fields.gender    || null,
      division:  fields.division  || null,
      rule_mode: fields.rule_mode || 'equal_opportunity',
      game_format_periods: fields.game_format_periods || 2,
      game_format_minutes_per_period: fields.game_format_minutes_per_period || 20
    }).select().single());
  }

  async function updateTeam(teamId, fields) {
    return check(await sb().from('teams').update(fields).eq('id', teamId).select().single());
  }

  async function deleteTeam(teamId) {
    return check(await sb().from('teams').delete().eq('id', teamId));
  }

  // ---------- RATINGS (per player per team) ----------

  async function listRatingsForTeam(teamId) {
    return check(await sb()
      .from('ratings')
      .select('*')
      .eq('team_id', teamId));
  }

  async function upsertRating(playerId, teamId, fields) {
    // Upsert by composite (player_id, team_id) — matches the unique constraint.
    return check(await sb().from('ratings').upsert({
      player_id: playerId,
      team_id: teamId,
      phy_speed: fields.phy_speed,
      phy_strength: fields.phy_strength,
      phy_size: fields.phy_size,
      phy_fitness: fields.phy_fitness,
      cs_shooting: fields.cs_shooting,
      cs_ball_handling: fields.cs_ball_handling,
      cs_passing: fields.cs_passing,
      cs_defence: fields.cs_defence,
      cs_rebounding: fields.cs_rebounding,
      iq_court_awareness: fields.iq_court_awareness,
      iq_decision_making: fields.iq_decision_making,
      notes: fields.notes || null,
      rated_at: new Date().toISOString()
    }, { onConflict: 'player_id,team_id' }).select().single());
  }

  async function deleteRating(playerId, teamId) {
    return check(await sb()
      .from('ratings')
      .delete()
      .eq('player_id', playerId)
      .eq('team_id', teamId));
  }

  async function isHeadCoachOfTeam(teamId, staffId) {
    const { data, error } = await sb()
      .from('team_staff')
      .select('id')
      .eq('team_id', teamId)
      .eq('staff_id', staffId)
      .eq('role', 'head_coach')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return !!data;
  }

  // ---------- TEAM <-> STAFF ASSIGNMENTS ----------

  async function listTeamStaff(teamId) {
    // Returns the team_staff rows joined with the staff record
    return check(await sb()
      .from('team_staff')
      .select('id, role, created_at, staff:staff_id ( id, full_name, email, is_admin, user_id )')
      .eq('team_id', teamId)
    );
  }

  async function assignStaffToTeam(teamId, staffId, role) {
    return check(await sb().from('team_staff').insert({
      team_id: teamId,
      staff_id: staffId,
      role: role
    }).select().single());
  }

  async function updateTeamStaffRole(teamStaffId, role) {
    return check(await sb().from('team_staff').update({ role }).eq('id', teamStaffId).select().single());
  }

  async function removeTeamStaff(teamStaffId) {
    return check(await sb().from('team_staff').delete().eq('id', teamStaffId));
  }

  // ---------- BENCH DUTY ----------

  // Duty pool = families with at least one ACTIVE player on this team.
  // Returned with their exclusions inline.
  async function listDutyPool(teamId) {
    // 1. Get distinct family_ids via active team_memberships → players
    const { data: memberships, error: mErr } = await sb()
      .from('team_memberships')
      .select('player:player_id ( family_id )')
      .eq('team_id', teamId)
      .eq('is_active', true);
    if (mErr) throw new Error(mErr.message);
    const familyIds = [...new Set((memberships || [])
      .map(m => m.player?.family_id)
      .filter(Boolean))];
    if (familyIds.length === 0) return [];

    // 2. Fetch families + exclusions
    return check(await sb()
      .from('families')
      .select('*, family_contacts(*), duty_pool_exclusions(*)')
      .in('id', familyIds)
      .order('family_name'));
  }

  async function createDutyExclusion(familyId, fields) {
    return check(await sb().from('duty_pool_exclusions').insert({
      family_id: familyId,
      exclusion_type: fields.exclusion_type,
      date_from: fields.date_from || null,
      date_to: fields.date_to || null,
      reason: fields.reason || null
    }).select().single());
  }

  async function removeDutyExclusion(exclusionId) {
    return check(await sb()
      .from('duty_pool_exclusions')
      .delete()
      .eq('id', exclusionId));
  }

  // All duty assignments for games belonging to this team
  async function listDutyAssignments(teamId) {
    return check(await sb()
      .from('duty_assignments')
      .select('*, game:game_id!inner ( id, team_id, game_date, game_time, opposition:opposition_id ( name ) ), family:family_id ( id, family_name )')
      .eq('game.team_id', teamId)
      .order('game(game_date)', { ascending: true }));
  }

  // Manual override — assign a specific family to a specific game
  async function upsertDutyAssignment(gameId, familyId, isLocked) {
    return check(await sb().from('duty_assignments').upsert({
      game_id: gameId,
      family_id: familyId,
      generated_at: new Date().toISOString(),
      is_locked: isLocked ?? false
    }, { onConflict: 'game_id' }).select().single());
  }

  async function setDutyAssignmentLock(assignmentId, isLocked) {
    return check(await sb()
      .from('duty_assignments')
      .update({ is_locked: !!isLocked })
      .eq('id', assignmentId)
      .select().single());
  }

  async function removeDutyAssignment(gameId) {
    return check(await sb()
      .from('duty_assignments')
      .delete()
      .eq('game_id', gameId));
  }

  // The fairness algorithm — generates duty assignments for all upcoming
  // SCHEDULED games of a team. Respects locked existing assignments and
  // family exclusions. Replaces unlocked assignments.
  async function generateDutyRoster(teamId) {
    const today = new Date().toISOString().slice(0, 10);
    const [pool, allAssignments, gamesResult] = await Promise.all([
      listDutyPool(teamId),
      listDutyAssignments(teamId),
      sb().from('games').select('id, game_date')
        .eq('team_id', teamId)
        .eq('status', 'scheduled')
        .gte('game_date', today)
        .order('game_date', { ascending: true })
    ]);
    if (gamesResult.error) throw new Error(gamesResult.error.message);
    const games = gamesResult.data || [];

    if (pool.length === 0) {
      throw new Error('Duty pool is empty. Add players (with family links) to this team first.');
    }

    // Fairness count = ALL assignments per family (past + future).
    // This way, if a family did three duties last month, they get fewer next.
    const familyCounts = {};
    for (const f of pool) familyCounts[f.id] = 0;
    for (const a of allAssignments) {
      if (familyCounts[a.family_id] === undefined) continue; // family no longer in pool
      familyCounts[a.family_id]++;
    }

    // Index existing assignments by game_id
    const existingByGame = {};
    for (const a of allAssignments) existingByGame[a.game_id] = a;

    // Helper: is family blocked on this date?
    const isBlocked = (family, gameDate) => {
      const excl = family.duty_pool_exclusions || [];
      return excl.some(e => {
        if (e.exclusion_type === 'full_season' && !e.date_from && !e.date_to) return true;
        const from = e.date_from ? new Date(e.date_from + 'T00:00:00') : new Date(0);
        const to   = e.date_to   ? new Date(e.date_to   + 'T23:59:59') : new Date(8640000000000000);
        const gd   = new Date(gameDate + 'T12:00:00');
        return gd >= from && gd <= to;
      });
    };

    // For each upcoming game (ordered by date), pick the lowest-count eligible family
    const toUpdate = [];   // { id, family_id }
    const toInsert = [];   // { game_id, family_id, generated_at }
    let skippedNoEligible = 0;

    for (const game of games) {
      const existing = existingByGame[game.id];
      if (existing && existing.is_locked) continue;   // never touch locked

      const eligible = pool.filter(f => !isBlocked(f, game.game_date));
      if (eligible.length === 0) {
        skippedNoEligible++;
        continue;
      }

      eligible.sort((a, b) => {
        const diff = (familyCounts[a.id] || 0) - (familyCounts[b.id] || 0);
        return diff !== 0 ? diff : a.family_name.localeCompare(b.family_name);
      });
      const chosen = eligible[0];

      // If existing unlocked assignment already matches chosen, no change needed
      if (existing && existing.family_id === chosen.id) continue;

      familyCounts[chosen.id]++;

      if (existing) {
        toUpdate.push({ id: existing.id, family_id: chosen.id });
      } else {
        toInsert.push({
          game_id: game.id,
          family_id: chosen.id,
          generated_at: new Date().toISOString(),
          is_locked: false
        });
      }
    }

    // Apply changes
    for (const u of toUpdate) {
      await sb().from('duty_assignments').update({
        family_id: u.family_id,
        generated_at: new Date().toISOString()
      }).eq('id', u.id);
    }
    if (toInsert.length > 0) {
      const { error } = await sb().from('duty_assignments').insert(toInsert);
      if (error) throw new Error(error.message);
    }

    return {
      games_total: games.length,
      assigned_now: toInsert.length,
      reassigned: toUpdate.length,
      skipped_no_eligible: skippedNoEligible,
      family_counts_after: familyCounts
    };
  }

  // ---------- DASHBOARD SUMMARY ----------

  async function getDashboardSummary(clubId) {
    // Fire all the lightweight count queries in parallel.
    const today = new Date().toISOString().slice(0, 10);
    const [teams, players, staff, games, upcoming] = await Promise.all([
      sb().from('teams').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
      sb().from('players').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
      sb().from('staff').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
      sb().from('games').select(`id, team:team_id!inner(id, club_id)`, { count: 'exact', head: true })
        .eq('team.club_id', clubId)
        .gte('game_date', today)
        .neq('status', 'cancelled'),
      sb().from('games')
        .select('*, team:team_id ( id, name, club_id ), opposition:opposition_id ( id, name )')
        .eq('team.club_id', clubId)
        .gte('game_date', today)
        .neq('status', 'cancelled')
        .order('game_date', { ascending: true })
        .order('game_time', { ascending: true, nullsFirst: false })
        .limit(5)
    ]);
    return {
      teams_count:    teams.count ?? 0,
      players_count:  players.count ?? 0,
      staff_count:    staff.count ?? 0,
      games_count:    games.count ?? 0,
      upcoming_games: upcoming.data || []
    };
  }

  // ---------- GAMES ----------

  async function listGames(teamId) {
    return check(await sb()
      .from('games')
      .select('*, opposition:opposition_id ( id, name, primary_color )')
      .eq('team_id', teamId)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true, nullsFirst: false }));
  }

  async function listUpcomingGames(teamId) {
    const today = new Date().toISOString().slice(0, 10);
    return check(await sb()
      .from('games')
      .select('*, opposition:opposition_id ( id, name )')
      .eq('team_id', teamId)
      .gte('game_date', today)
      .neq('status', 'cancelled')
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true, nullsFirst: false }));
  }

  async function getGame(gameId) {
    return check(await sb()
      .from('games')
      .select('*, team:team_id ( id, name, game_format_periods, game_format_minutes_per_period ), opposition:opposition_id ( id, name, primary_color )')
      .eq('id', gameId)
      .single());
  }

  async function createGame(teamId, fields) {
    return check(await sb().from('games').insert({
      team_id: teamId,
      opposition_id: fields.opposition_id || null,
      game_date: fields.game_date,
      game_time: fields.game_time || null,
      venue: fields.venue || null,
      court: fields.court || null,
      periods: fields.periods ?? null,
      minutes_per_period: fields.minutes_per_period ?? null,
      status: fields.status || 'scheduled',
      notes: fields.notes || null
    }).select().single());
  }

  async function updateGame(gameId, fields) {
    return check(await sb().from('games').update(fields).eq('id', gameId).select().single());
  }

  async function deleteGame(gameId) {
    return check(await sb().from('games').delete().eq('id', gameId));
  }

  async function getGameWeekStatus(teamId) {
    return check(await sb()
      .from('game_week_status')
      .select('*')
      .eq('team_id', teamId)
      .order('game_date', { ascending: true }));
  }

  // ---------- TEAMS THE CURRENT USER CAN EDIT ----------

  async function listMyEditableTeams(clubId, currentStaff) {
    // Admins can edit all teams in club. Non-admins only edit teams they're
    // assigned to via team_staff. Returns full team rows.
    if (currentStaff?.is_admin) {
      return listTeams(clubId);
    }
    const { data, error } = await sb()
      .from('team_staff')
      .select('team:team_id ( * )')
      .eq('staff_id', currentStaff.id);
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.team).filter(t => t).sort((a,b) => a.name.localeCompare(b.name));
  }

  // ---------- FAMILIES + CONTACTS (CLUB-LEVEL) ----------

  async function listFamilies(clubId) {
    return check(await sb()
      .from('families')
      .select('*, family_contacts(*)')
      .eq('club_id', clubId)
      .order('family_name')
    );
  }

  async function createFamily(clubId, fields) {
    return check(await sb().from('families').insert({
      club_id: clubId,
      family_name: fields.family_name,
      notes: fields.notes || null
    }).select().single());
  }

  async function updateFamily(familyId, fields) {
    return check(await sb().from('families').update(fields).eq('id', familyId).select().single());
  }

  async function deleteFamily(familyId) {
    return check(await sb().from('families').delete().eq('id', familyId));
  }

  async function addFamilyContact(familyId, fields) {
    return check(await sb().from('family_contacts').insert({
      family_id: familyId,
      name: fields.name,
      relationship: fields.relationship || null,
      phone: fields.phone || null,
      email: fields.email || null,
      is_primary: !!fields.is_primary
    }).select().single());
  }

  async function updateFamilyContact(contactId, fields) {
    return check(await sb().from('family_contacts').update(fields).eq('id', contactId).select().single());
  }

  async function removeFamilyContact(contactId) {
    return check(await sb().from('family_contacts').delete().eq('id', contactId));
  }

  // ---------- PLAYERS (CLUB-LEVEL) ----------

  async function listClubPlayers(clubId) {
    // All players in the club, with family + memberships
    return check(await sb()
      .from('players')
      .select('*, family:family_id ( id, family_name ), team_memberships(*, team:team_id (id, name))')
      .eq('club_id', clubId)
      .order('full_name')
    );
  }

  async function createClubPlayer(clubId, fields) {
    return check(await sb().from('players').insert({
      club_id:   clubId,
      family_id: fields.family_id || null,
      full_name: fields.full_name,
      dob:       fields.dob || null,
      photo_url: fields.photo_url || null,
      notes:     fields.notes || null
    }).select().single());
  }

  async function updatePlayer(playerId, fields) {
    return check(await sb().from('players').update(fields).eq('id', playerId).select().single());
  }

  async function deletePlayer(playerId) {
    return check(await sb().from('players').delete().eq('id', playerId));
  }

  // ---------- TEAM MEMBERSHIPS (per-team facts) ----------

  async function listTeamRoster(teamId) {
    // The roster of a team — memberships joined with player + family
    return check(await sb()
      .from('team_memberships')
      .select('*, player:player_id ( id, full_name, dob, photo_url, family:family_id ( id, family_name ) )')
      .eq('team_id', teamId)
      .order('jersey_no', { nullsFirst: false })
    );
  }

  async function createMembership(teamId, playerId, fields) {
    return check(await sb().from('team_memberships').insert({
      team_id:   teamId,
      player_id: playerId,
      jersey_no: fields.jersey_no ?? null,
      positions: fields.positions || null,
      is_active: fields.is_active !== false,
      joined_at: fields.joined_at || null
    }).select().single());
  }

  async function updateMembership(membershipId, fields) {
    return check(await sb().from('team_memberships').update(fields).eq('id', membershipId).select().single());
  }

  async function removeMembership(membershipId) {
    return check(await sb().from('team_memberships').delete().eq('id', membershipId));
  }

  // ---------- SEASONS ----------

  async function listSeasons(clubId) {
    return check(await sb()
      .from('seasons')
      .select('*')
      .eq('club_id', clubId)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('name'));
  }

  async function getCurrentSeason(clubId) {
    const { data, error } = await sb()
      .from('seasons')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function createSeason(clubId, fields) {
    return check(await sb().from('seasons').insert({
      club_id: clubId,
      name: fields.name,
      start_date: fields.start_date || null,
      end_date: fields.end_date || null,
      is_current: !!fields.is_current
    }).select().single());
  }

  async function updateSeason(seasonId, fields) {
    return check(await sb().from('seasons').update(fields).eq('id', seasonId).select().single());
  }

  async function deleteSeason(seasonId) {
    return check(await sb().from('seasons').delete().eq('id', seasonId));
  }

  // ---------- OPPONENTS ----------

  async function listOpponents(clubId) {
    return check(await sb()
      .from('opponents')
      .select('*')
      .eq('club_id', clubId)
      .order('name'));
  }

  async function createOpponent(clubId, fields) {
    return check(await sb().from('opponents').insert({
      club_id: clubId,
      name: fields.name,
      age_group: fields.age_group || null,
      division:  fields.division  || null,
      logo_url: fields.logo_url || null,
      primary_color: fields.primary_color || null,
      notes: fields.notes || null
    }).select().single());
  }

  async function updateOpponent(opponentId, fields) {
    return check(await sb().from('opponents').update(fields).eq('id', opponentId).select().single());
  }

  async function deleteOpponent(opponentId) {
    return check(await sb().from('opponents').delete().eq('id', opponentId));
  }

  // ---------- PLAYER PREFERENCES (per player per season) ----------

  async function getPlayerPreference(playerId, seasonId) {
    const { data, error } = await sb()
      .from('player_preferences')
      .select('*')
      .eq('player_id', playerId)
      .eq('season_id', seasonId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async function upsertPlayerPreference(playerId, seasonId, fields) {
    return check(await sb().from('player_preferences').upsert({
      player_id: playerId,
      season_id: seasonId,
      intention_to_play: fields.intention_to_play ?? null,
      registration_status: fields.registration_status || 'unknown',
      preferred_days: fields.preferred_days || null,
      wants_to_play_with: fields.wants_to_play_with || null,
      preferred_coach: fields.preferred_coach || null,
      notes: fields.notes || null,
      source: fields.source || 'manual'
    }, { onConflict: 'player_id,season_id' }).select().single());
  }

  async function listSeasonPreferences(seasonId) {
    return check(await sb()
      .from('player_preferences')
      .select('*, player:player_id ( id, full_name, dob, gender )')
      .eq('season_id', seasonId));
  }

  // ---------- PLAYS + STATS (CourtSide bridge) ----------

  async function listPlays(gameId) {
    return check(await sb()
      .from('plays')
      .select('*, player:player_id ( id, full_name )')
      .eq('game_id', gameId)
      .order('period')
      .order('recorded_at'));
  }

  async function recordPlay(gameId, fields) {
    return check(await sb().from('plays').insert({
      game_id: gameId,
      player_id: fields.player_id,
      period: fields.period,
      seconds_into_period: fields.seconds_into_period ?? null,
      stat_type: fields.stat_type,
      made: fields.made ?? null,
      assist_player_id: fields.assist_player_id || null,
      source: fields.source || 'manual'
    }).select().single());
  }

  async function deletePlay(playId) {
    return check(await sb().from('plays').delete().eq('id', playId));
  }

  async function getPlayerGameStats(gameId) {
    return check(await sb()
      .from('player_game_stats')
      .select('*')
      .eq('game_id', gameId));
  }

  return {
    sb,
    getCurrentStaff,
    getClub, updateClub,
    listStaff, createPendingStaff, updateStaff, removeStaff,
    listTeams, getTeam, createTeam, updateTeam, deleteTeam,
    listTeamStaff, assignStaffToTeam, updateTeamStaffRole, removeTeamStaff,
    listGames, listUpcomingGames, getGame, createGame, updateGame, deleteGame, getGameWeekStatus,
    getDashboardSummary,
    listDutyPool, createDutyExclusion, removeDutyExclusion,
    listDutyAssignments, upsertDutyAssignment, setDutyAssignmentLock, removeDutyAssignment,
    generateDutyRoster,
    listMyEditableTeams,
    listFamilies, createFamily, updateFamily, deleteFamily,
    addFamilyContact, updateFamilyContact, removeFamilyContact,
    listClubPlayers, createClubPlayer, updatePlayer, deletePlayer,
    listTeamRoster, createMembership, updateMembership, removeMembership,
    listRatingsForTeam, upsertRating, deleteRating, isHeadCoachOfTeam,
    listSeasons, getCurrentSeason, createSeason, updateSeason, deleteSeason,
    listOpponents, createOpponent, updateOpponent, deleteOpponent,
    getPlayerPreference, upsertPlayerPreference, listSeasonPreferences,
    listPlays, recordPlay, deletePlay, getPlayerGameStats
  };
})();
