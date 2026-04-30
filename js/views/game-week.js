// =====================================================================
// Game Week view — per-game workflow shell
// Day -7 / -2 / -1 / Game day / Post-game cards.
// Workflow content (comms generation, rotation, attendance) lands in steps 7–9.
// Post-game data entry (score + result + notes) is wired here.
// =====================================================================
function gameWeekView(currentClub, currentStaff, gameId, onNavigate) {
  return {
    loading: true,
    saving: false,
    error: '',
    game: null,

    // Bench duty
    dutyPool: [],
    dutyAssignment: null,
    showDutyReassign: false,
    selectedDutyPlayer: '',

    // Post-game form state
    postGame: {
      team_score: '',
      opposition_score: '',
      result: '',
      notes: '',
      status: 'scheduled'
    },
    postGameDirty: false,

    async init() {
      try {
        await this.loadGame();
        await this.loadDuty();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async loadGame() {
      this.game = await window.GTWData.getGame(gameId);
      this.postGame = {
        team_score: this.game.team_score ?? '',
        opposition_score: this.game.opposition_score ?? '',
        result: this.game.result || '',
        notes: this.game.notes || '',
        status: this.game.status
      };
      this.postGameDirty = false;
    },

    async loadDuty() {
      if (!this.game?.team?.id) return;
      const [pool, allAssignments] = await Promise.all([
        window.GTWData.listDutyPool(this.game.team.id),
        window.GTWData.listDutyAssignments(this.game.team.id)
      ]);
      this.dutyPool = pool;
      this.dutyAssignment = allAssignments.find(a => a.game_id === gameId) || null;
    },

    dutyPlayerLabel() {
      const a = this.dutyAssignment;
      if (!a?.player) return null;
      const fam = a.player.family?.family_name;
      return fam ? `${a.player.full_name} (${fam})` : a.player.full_name;
    },

    async toggleDutyLock() {
      if (!this.dutyAssignment) return;
      try {
        await window.GTWData.setDutyAssignmentLock(this.dutyAssignment.id, !this.dutyAssignment.is_locked);
        await this.loadDuty();
      } catch (err) {
        this.error = err.message;
      }
    },

    startDutyReassign() {
      this.selectedDutyPlayer = this.dutyAssignment?.player_id || '';
      this.showDutyReassign = true;
    },

    cancelDutyReassign() {
      this.showDutyReassign = false;
      this.selectedDutyPlayer = '';
    },

    eligibleDutyPool() {
      return this.dutyPool.filter(m => m.duty_eligible);
    },

    async saveDutyReassign() {
      if (!this.selectedDutyPlayer) return;
      try {
        await window.GTWData.upsertDutyAssignment(gameId, this.selectedDutyPlayer, true);   // manual = locked
        this.showDutyReassign = false;
        await this.loadDuty();
      } catch (err) {
        this.error = err.message;
      }
    },

    async clearDuty() {
      if (!confirm('Clear bench duty assignment for this game?')) return;
      try {
        await window.GTWData.removeDutyAssignment(gameId);
        await this.loadDuty();
      } catch (err) {
        this.error = err.message;
      }
    },

    canEdit() {
      if (currentStaff?.is_admin) return true;
      // Need to verify current user is on the team's staff. Defer to RLS to enforce.
      return true;
    },

    backToList() {
      onNavigate('games');
    },

    // ---- formatting ----
    formatDate(d) {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },

    formatTime(t) {
      if (!t) return '';
      return t.slice(0, 5);
    },

    daysToGo() {
      if (!this.game?.game_date) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dt = new Date(this.game.game_date + 'T00:00:00');
      return Math.round((dt - today) / 86400000);
    },

    daysLabel() {
      const n = this.daysToGo();
      if (n === null) return '';
      if (n === 0) return 'Game day';
      if (n === 1) return 'Tomorrow';
      if (n > 0) return `${n} days to go`;
      if (n === -1) return 'Yesterday';
      return `${Math.abs(n)} days ago`;
    },

    formatLabel() {
      if (!this.game) return '';
      const periods = this.game.periods ?? this.game.team?.game_format_periods;
      const minutes = this.game.minutes_per_period ?? this.game.team?.game_format_minutes_per_period;
      return `${periods} × ${minutes} min (${periods * minutes} min total)`;
    },

    statusBadgeClass(status) {
      return {
        scheduled: 'bg-brand-100 text-brand-700',
        completed: 'bg-slate-200 text-slate-700',
        cancelled: 'bg-red-100 text-red-700',
        bye:       'bg-amber-100 text-amber-700'
      }[status] || 'bg-slate-200 text-slate-700';
    },

    // ---- workflow step states ----
    // These are stub placeholders until comms/rotation/duty modules ship.
    workflowSteps() {
      const days = this.daysToGo();
      return [
        {
          key: 'availability',
          icon: '📨',
          label: 'Day -7 to -3 — Availability request',
          windowOpen: days >= 3,
          windowPast: days < -1,
          status: 'Not yet sent',
          placeholder: 'Generate copy/paste message — coming in step 9 (Comms templates).'
        },
        {
          key: 'logistics',
          icon: '📨',
          label: 'Day -2 — Logistics + bench duty reminder',
          windowOpen: days >= -1 && days <= 2,
          windowPast: days < -1,
          status: 'Not yet sent · Duty assignment coming in step 7',
          placeholder: 'Generate copy/paste message — coming in step 9. Bench duty assignment — coming in step 7.'
        },
        {
          key: 'gameday',
          icon: '📨',
          label: 'Day -1 — Game day notice + rotation',
          windowOpen: days >= -1 && days <= 1,
          windowPast: days < 0,
          status: 'Not yet sent · Rotation coming in step 8',
          placeholder: 'Generate rotation chart and copy/paste message — coming in steps 8 + 9.'
        }
      ];
    },

    // ---- post-game ----
    onPostGameChange() {
      this.postGameDirty = true;
      // If both scores set, auto-compute result
      const ts = parseInt(this.postGame.team_score, 10);
      const os = parseInt(this.postGame.opposition_score, 10);
      if (!isNaN(ts) && !isNaN(os) && this.postGame.status === 'completed') {
        if (ts > os) this.postGame.result = 'win';
        else if (ts < os) this.postGame.result = 'loss';
        else this.postGame.result = 'draw';
      }
    },

    async savePostGame() {
      this.error = '';
      this.saving = true;
      try {
        const payload = {
          team_score: this.postGame.team_score === '' ? null : parseInt(this.postGame.team_score, 10),
          opposition_score: this.postGame.opposition_score === '' ? null : parseInt(this.postGame.opposition_score, 10),
          result: this.postGame.result || null,
          notes: this.postGame.notes.trim() || null,
          status: this.postGame.status
        };
        await window.GTWData.updateGame(gameId, payload);
        await this.loadGame();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    }
  };
}

window.gameWeekView = gameWeekView;
