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
        season: this.team.season || '',
        rule_mode: this.team.rule_mode,
        game_format_periods: this.team.game_format_periods,
        game_format_minutes_per_period: this.team.game_format_minutes_per_period
      };
      this.teamStaff = await window.GTWData.listTeamStaff(teamId);
      this.clubStaff = await window.GTWData.listStaff(currentClub.id);
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
          season: this.teamForm.season.trim() || null,
          rule_mode: this.teamForm.rule_mode,
          game_format_periods: parseInt(this.teamForm.game_format_periods, 10),
          game_format_minutes_per_period: parseInt(this.teamForm.game_format_minutes_per_period, 10)
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
    }
  };
}

window.teamDetailView = teamDetailView;
