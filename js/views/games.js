// =====================================================================
// Games view — schedule list + create/edit per team
// =====================================================================
function gamesView(currentClub, currentStaff, onNavigate) {
  return {
    loading: true,
    saving: false,
    error: '',

    teams: [],
    selectedTeamId: '',
    games: [],
    opponents: [],

    showForm: false,
    editingGameId: null,
    form: emptyGameForm(),

    // Inline new opponent
    showNewOpponent: false,
    newOpponentName: '',

    async init() {
      try {
        this.teams = await window.GTWData.listMyEditableTeams(currentClub.id, currentStaff);
        const last = localStorage.getItem('gtw_last_team');
        if (last && this.teams.some(t => t.id === last)) {
          this.selectedTeamId = last;
        } else if (this.teams.length > 0) {
          this.selectedTeamId = this.teams[0].id;
        }
        this.opponents = await window.GTWData.listOpponents(currentClub.id);
        if (this.selectedTeamId) await this.loadGames();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async onTeamChange() {
      localStorage.setItem('gtw_last_team', this.selectedTeamId);
      this.cancelForm();
      await this.loadGames();
    },

    async loadGames() {
      this.error = '';
      try {
        this.games = await window.GTWData.listGames(this.selectedTeamId);
      } catch (err) {
        this.error = err.message;
      }
    },

    canEdit() {
      if (currentStaff?.is_admin) return true;
      return this.teams.some(t => t.id === this.selectedTeamId);
    },

    selectedTeam() {
      return this.teams.find(t => t.id === this.selectedTeamId);
    },

    selectedTeamName() {
      return this.selectedTeam()?.name || '';
    },

    // ---- helpers ----
    formatDate(d) {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    },

    formatTime(t) {
      if (!t) return '';
      // t comes as 'HH:MM:SS' — strip seconds
      return t.slice(0, 5);
    },

    daysToGo(d) {
      if (!d) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dt = new Date(d + 'T00:00:00');
      return Math.round((dt - today) / 86400000);
    },

    daysLabel(d) {
      const n = this.daysToGo(d);
      if (n === null) return '';
      if (n === 0) return 'Today';
      if (n === 1) return 'Tomorrow';
      if (n > 0) return `In ${n} days`;
      if (n === -1) return 'Yesterday';
      return `${Math.abs(n)} days ago`;
    },

    statusBadgeClass(status) {
      return {
        scheduled: 'bg-brand-100 text-brand-700',
        completed: 'bg-slate-200 text-slate-700',
        cancelled: 'bg-red-100 text-red-700',
        bye:       'bg-amber-100 text-amber-700'
      }[status] || 'bg-slate-200 text-slate-700';
    },

    formatLabel(g) {
      const team = this.selectedTeam();
      const periods = g.periods ?? team?.game_format_periods;
      const minutes = g.minutes_per_period ?? team?.game_format_minutes_per_period;
      return `${periods} × ${minutes}`;
    },

    // ---- create / edit ----
    startNew() {
      this.editingGameId = null;
      this.form = emptyGameForm();
      // Default to team's format
      const team = this.selectedTeam();
      this.form.periods = team?.game_format_periods ?? 2;
      this.form.minutes_per_period = team?.game_format_minutes_per_period ?? 20;
      this.showForm = true;
    },

    startEdit(g) {
      this.editingGameId = g.id;
      this.form = {
        opposition_id: g.opposition?.id || '',
        game_date: g.game_date,
        game_time: g.game_time ? g.game_time.slice(0, 5) : '',
        venue: g.venue || '',
        court: g.court || '',
        periods: g.periods ?? this.selectedTeam()?.game_format_periods ?? 2,
        minutes_per_period: g.minutes_per_period ?? this.selectedTeam()?.game_format_minutes_per_period ?? 20,
        status: g.status,
        notes: g.notes || ''
      };
      this.showForm = true;
    },

    cancelForm() {
      this.showForm = false;
      this.editingGameId = null;
      this.form = emptyGameForm();
      this.showNewOpponent = false;
      this.newOpponentName = '';
    },

    async saveGame() {
      this.error = '';
      if (!this.form.game_date) {
        this.error = 'Game date is required.';
        return;
      }
      this.saving = true;
      try {
        const payload = {
          opposition_id: this.form.opposition_id || null,
          game_date: this.form.game_date,
          game_time: this.form.game_time || null,
          venue: this.form.venue.trim() || null,
          court: this.form.court.trim() || null,
          periods: this.form.periods === '' ? null : parseInt(this.form.periods, 10),
          minutes_per_period: this.form.minutes_per_period === '' ? null : parseInt(this.form.minutes_per_period, 10),
          status: this.form.status,
          notes: this.form.notes.trim() || null
        };
        if (this.editingGameId) {
          await window.GTWData.updateGame(this.editingGameId, payload);
        } else {
          await window.GTWData.createGame(this.selectedTeamId, payload);
        }
        this.cancelForm();
        await this.loadGames();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    async deleteGame(g) {
      if (!confirm(`Delete the game vs ${g.opposition?.name || 'opponent'} on ${this.formatDate(g.game_date)}? Removes attendance, plays, rotations, comms, everything for this game.`)) return;
      try {
        await window.GTWData.deleteGame(g.id);
        await this.loadGames();
      } catch (err) {
        this.error = err.message;
      }
    },

    open(g) {
      onNavigate('games', g.id);
    },

    // ---- inline opponent creation ----
    async addOpponent() {
      this.error = '';
      if (!this.newOpponentName.trim()) {
        this.error = 'Opponent name required.';
        return;
      }
      try {
        const created = await window.GTWData.createOpponent(currentClub.id, {
          name: this.newOpponentName.trim()
        });
        this.opponents.push(created);
        this.opponents.sort((a, b) => a.name.localeCompare(b.name));
        this.form.opposition_id = created.id;
        this.showNewOpponent = false;
        this.newOpponentName = '';
      } catch (err) {
        // Most likely a duplicate name — surface the message
        this.error = err.message;
      }
    }
  };
}

function emptyGameForm() {
  return {
    opposition_id: '',
    game_date: '',
    game_time: '',
    venue: '',
    court: '',
    periods: '',
    minutes_per_period: '',
    status: 'scheduled',
    notes: ''
  };
}

window.gamesView = gamesView;
