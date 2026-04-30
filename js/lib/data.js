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
