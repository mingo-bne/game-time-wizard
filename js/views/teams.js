// =====================================================================
// Teams view — list + create + delete (edit happens in team-detail view)
// =====================================================================
function teamsView(currentClub, currentStaff, onNavigate) {
  return {
    loading: true,
    saving: false,
    error: '',
    teams: [],
    showCreate: false,
    newTeam: {
      name: '',
      age_group: '',
      gender: '',
      division: '',
      rule_mode: 'equal_opportunity',
      game_format_periods: 2,
      game_format_minutes_per_period: 20
    },

    async init() {
      await this.loadTeams();
      this.loading = false;
    },

    isAdmin() {
      return currentStaff?.is_admin === true;
    },

    async loadTeams() {
      this.error = '';
      try {
        this.teams = await window.GTWData.listTeams(currentClub.id);
      } catch (err) {
        this.error = err.message;
      }
    },

    formatLabel(t) {
      return `${t.game_format_periods} × ${t.game_format_minutes_per_period} min`;
    },

    ruleLabel(t) {
      return t.rule_mode === 'equal_opportunity' ? 'Equal Opportunity' : 'No Engine (manual)';
    },

    genderLabel(g) {
      return { M: 'Boys', F: 'Girls', X: 'Mixed', NA: 'Open' }[g] || '—';
    },

    startCreate() {
      this.newTeam = {
        name: '',
        age_group: '',
        gender: '',
        division: '',
        rule_mode: 'equal_opportunity',
        game_format_periods: 2,
        game_format_minutes_per_period: 20
      };
      this.showCreate = true;
    },

    async createTeam() {
      this.error = '';
      if (!this.newTeam.name.trim()) {
        this.error = 'Team name is required.';
        return;
      }
      this.saving = true;
      try {
        const created = await window.GTWData.createTeam(currentClub.id, {
          ...this.newTeam,
          name: this.newTeam.name.trim(),
          age_group: this.newTeam.age_group.trim(),
          gender: this.newTeam.gender || null,
          division: this.newTeam.division.trim(),
          game_format_periods: parseInt(this.newTeam.game_format_periods, 10),
          game_format_minutes_per_period: parseInt(this.newTeam.game_format_minutes_per_period, 10)
        });
        this.showCreate = false;
        await this.loadTeams();
        // Auto-navigate to the new team detail
        onNavigate('teams', created.id);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    open(team) {
      onNavigate('teams', team.id);
    },

    async deleteTeam(team) {
      if (!confirm(`Delete team "${team.name}"? This removes all of its players, games, ratings, and history. Cannot be undone.`)) return;
      try {
        await window.GTWData.deleteTeam(team.id);
        await this.loadTeams();
      } catch (err) {
        this.error = err.message;
      }
    }
  };
}

window.teamsView = teamsView;
