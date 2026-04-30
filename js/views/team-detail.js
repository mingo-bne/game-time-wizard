// =====================================================================
// Team Detail view — edit team settings + manage staff assignments
// =====================================================================
function teamDetailView(currentClub, currentStaff, teamId, onNavigate) {
  return {
    loading: true,
    saving: false,
    error: '',
    team: null,
    teamForm: {},
    teamStaff: [],
    clubStaff: [],
    showAddStaff: false,
    selectedStaffId: '',
    selectedRole: 'assistant_coach',

    // Bench duty state
    dutyPool: [],
    dutyAssignments: [],
    dutyLoading: false,
    dutyError: '',
    showExclusionForm: null,           // family_id when adding an exclusion
    exclusionForm: emptyExclusionForm(),

    async init() {
      try {
        await this.loadAll();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async loadAll() {
      this.team = await window.GTWData.getTeam(teamId);
      this.teamForm = {
        name: this.team.name,
        age_group: this.team.age_group || '',
        gender: this.team.gender || '',
        division: this.team.division || '',
        rule_mode: this.team.rule_mode,
        game_format_periods: this.team.game_format_periods,
        game_format_minutes_per_period: this.team.game_format_minutes_per_period,
        rotation_block_minutes: this.team.rotation_block_minutes ?? 2
      };
      this.teamStaff = await window.GTWData.listTeamStaff(teamId);
      this.clubStaff = await window.GTWData.listStaff(currentClub.id);
      await this.loadDuty();
    },

    async loadDuty() {
      this.dutyError = '';
      try {
        const [pool, assignments] = await Promise.all([
          window.GTWData.listDutyPool(teamId),
          window.GTWData.listDutyAssignments(teamId)
        ]);
        this.dutyPool = pool;
        this.dutyAssignments = assignments;
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    // Map player_id → number of duty assignments (across all this team's games)
    dutyCounts() {
      const counts = {};
      for (const m of this.dutyPool) counts[m.player.id] = 0;
      for (const a of this.dutyAssignments) {
        if (counts[a.player_id] !== undefined) counts[a.player_id]++;
      }
      return counts;
    },

    eligiblePoolCount() {
      return this.dutyPool.filter(m => m.duty_eligible).length;
    },

    formatDutyDate(d) {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    exclusionsForPlayer(playerId) {
      const m = this.dutyPool.find(x => x.player?.id === playerId);
      return m?.player?.duty_pool_exclusions || [];
    },

    async toggleDutyEligibility(membership) {
      try {
        await window.GTWData.setDutyEligibility(membership.id, !membership.duty_eligible);
        await this.loadDuty();
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    exclusionLabel(e) {
      const type = { one_off: 'One-off', partial: 'Date range', full_season: 'Full season' }[e.exclusion_type] || e.exclusion_type;
      let dates = '';
      if (e.exclusion_type === 'one_off' && e.date_from) {
        dates = ` on ${this.formatDutyDate(e.date_from)}`;
      } else if (e.exclusion_type === 'partial' && (e.date_from || e.date_to)) {
        dates = ` ${e.date_from ? 'from ' + this.formatDutyDate(e.date_from) : ''} ${e.date_to ? 'to ' + this.formatDutyDate(e.date_to) : ''}`.trim();
      } else if (e.exclusion_type === 'full_season') {
        dates = ' (whole season)';
      }
      return type + dates + (e.reason ? ` — ${e.reason}` : '');
    },

    startAddExclusion(playerId) {
      this.exclusionForm = emptyExclusionForm();
      this.showExclusionForm = playerId;
    },

    cancelExclusionForm() {
      this.showExclusionForm = null;
      this.exclusionForm = emptyExclusionForm();
    },

    async saveExclusion() {
      this.dutyError = '';
      try {
        const payload = {
          exclusion_type: this.exclusionForm.exclusion_type,
          date_from: this.exclusionForm.date_from || null,
          date_to: this.exclusionForm.date_to || null,
          reason: this.exclusionForm.reason?.trim() || null
        };
        // For one-off, copy date_from to date_to
        if (payload.exclusion_type === 'one_off') payload.date_to = payload.date_from;
        await window.GTWData.createDutyExclusion(this.showExclusionForm, payload);
        this.cancelExclusionForm();
        await this.loadDuty();
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    async removeExclusion(exclusionId) {
      if (!confirm('Remove this exclusion?')) return;
      try {
        await window.GTWData.removeDutyExclusion(exclusionId);
        await this.loadDuty();
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    async runGenerateRoster() {
      this.dutyError = '';
      const hasUnlocked = this.dutyAssignments.some(a => !a.is_locked);
      if (hasUnlocked && !confirm('Regenerate the duty roster? Unlocked assignments will be reshuffled. Locked ones stay put.')) return;
      this.dutyLoading = true;
      try {
        const result = await window.GTWData.generateDutyRoster(teamId);
        await this.loadDuty();
        let msg = `Roster generated. ${result.assigned_now} new, ${result.reassigned} reshuffled.`;
        if (result.skipped_no_eligible > 0) msg += ` ${result.skipped_no_eligible} games had no eligible family (all excluded).`;
        alert(msg);
      } catch (err) {
        this.dutyError = err.message;
      } finally {
        this.dutyLoading = false;
      }
    },

    async toggleLock(a) {
      try {
        await window.GTWData.setDutyAssignmentLock(a.id, !a.is_locked);
        await this.loadDuty();
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    async manualReassign(gameId, familyId) {
      try {
        await window.GTWData.upsertDutyAssignment(gameId, familyId, true);   // manual override is auto-locked
        await this.loadDuty();
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    async clearAssignment(gameId) {
      if (!confirm('Clear this duty assignment?')) return;
      try {
        await window.GTWData.removeDutyAssignment(gameId);
        await this.loadDuty();
      } catch (err) {
        this.dutyError = err.message;
      }
    },

    canEdit() {
      // Admin or any staff already assigned to this team can edit
      if (currentStaff?.is_admin) return true;
      return this.teamStaff.some(ts => ts.staff?.id === currentStaff?.id);
    },

    isAdmin() {
      return currentStaff?.is_admin === true;
    },

    async saveTeam() {
      this.error = '';
      this.saving = true;
      try {
        await window.GTWData.updateTeam(teamId, {
          name: this.teamForm.name.trim(),
          age_group: this.teamForm.age_group.trim() || null,
          gender: this.teamForm.gender || null,
          division: this.teamForm.division.trim() || null,
          rule_mode: this.teamForm.rule_mode,
          game_format_periods: parseInt(this.teamForm.game_format_periods, 10),
          game_format_minutes_per_period: parseInt(this.teamForm.game_format_minutes_per_period, 10),
          rotation_block_minutes: parseInt(this.teamForm.rotation_block_minutes, 10) || 2
        });
        await this.loadAll();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    // Returns staff in the club who are NOT yet assigned to this team
    unassignedStaff() {
      const assignedIds = new Set(this.teamStaff.map(ts => ts.staff?.id));
      return this.clubStaff.filter(s => !assignedIds.has(s.id));
    },

    startAddStaff() {
      const candidates = this.unassignedStaff();
      this.selectedStaffId = candidates[0]?.id || '';
      this.selectedRole = 'assistant_coach';
      this.showAddStaff = true;
    },

    async assignStaff() {
      this.error = '';
      if (!this.selectedStaffId) {
        this.error = 'Pick a staff member to assign.';
        return;
      }
      try {
        await window.GTWData.assignStaffToTeam(teamId, this.selectedStaffId, this.selectedRole);
        this.showAddStaff = false;
        await this.loadAll();
      } catch (err) {
        this.error = err.message;
      }
    },

    async changeRole(ts, role) {
      try {
        await window.GTWData.updateTeamStaffRole(ts.id, role);
        await this.loadAll();
      } catch (err) {
        this.error = err.message;
      }
    },

    async unassign(ts) {
      if (!confirm(`Remove ${ts.staff?.full_name} from this team? They remain in the club.`)) return;
      try {
        await window.GTWData.removeTeamStaff(ts.id);
        await this.loadAll();
      } catch (err) {
        this.error = err.message;
      }
    },

    backToList() {
      onNavigate('teams');
    },

    roleLabel(role) {
      return {
        head_coach:      'Head Coach',
        assistant_coach: 'Assistant Coach',
        team_manager:    'Team Manager'
      }[role] || role;
    },

    genderLabel(g) {
      return { M: 'Boys', F: 'Girls', X: 'Mixed', NA: 'Open' }[g] || '—';
    }
  };
}

function emptyExclusionForm() {
  return { exclusion_type: 'one_off', date_from: '', date_to: '', reason: '' };
}

window.teamDetailView = teamDetailView;
