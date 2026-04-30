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
    return check(await sb().from('teams').insert({
      club_id: clubId,
      name: fields.name,
      age_group: fields.age_group || null,
      season: fields.season || null,
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

  return {
    sb,
    getCurrentStaff,
    getClub, updateClub,
    listStaff, createPendingStaff, updateStaff, removeStaff,
    listTeams, getTeam, createTeam, updateTeam, deleteTeam,
    listTeamStaff, assignStaffToTeam, updateTeamStaffRole, removeTeamStaff
  };
})();
