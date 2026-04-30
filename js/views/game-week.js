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

    // Availability + rotation
    roster: [],                       // team_memberships joined with player
    borrowedPlayers: [],              // game_borrowed_players for this game
    availabilities: [],               // existing availability rows
    rotationPlan: null,               // rotation_plans row (or null)
    generatingRotation: false,
    showAvailability: false,
    showBorrowPicker: false,
    borrowCandidates: [],
    borrowSearch: '',
    selectedBorrowPlayer: '',
    borrowWeight: 0.5,

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
        await Promise.all([
          this.loadDuty(),
          this.loadAvailabilityAndRotation()
        ]);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async loadAvailabilityAndRotation() {
      if (!this.game?.team?.id) return;
      const [roster, borrowed, avail, plan] = await Promise.all([
        window.GTWData.listTeamRoster(this.game.team.id),
        window.GTWData.listBorrowedPlayers(gameId),
        window.GTWData.listAvailabilities(gameId),
        window.GTWData.getRotationPlan(gameId)
      ]);
      this.roster = roster;
      this.borrowedPlayers = borrowed;
      this.availabilities = avail;
      this.rotationPlan = plan;
    },

    // ============ BORROWED PLAYERS ============

    async openBorrowPicker() {
      try {
        this.borrowCandidates = await window.GTWData.listBorrowCandidates(currentClub.id, this.game.team.id);
        // Exclude players already borrowed for this game
        const alreadyIds = new Set(this.borrowedPlayers.map(b => b.player_id));
        this.borrowCandidates = this.borrowCandidates.filter(p => !alreadyIds.has(p.id));
        this.selectedBorrowPlayer = '';
        this.borrowWeight = 0.5;
        this.borrowSearch = '';
        this.showBorrowPicker = true;
      } catch (err) {
        this.error = err.message;
      }
    },

    filteredBorrowCandidates() {
      const q = this.borrowSearch.trim().toLowerCase();
      if (!q) return this.borrowCandidates;
      return this.borrowCandidates.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.family?.family_name || '').toLowerCase().includes(q));
    },

    cancelBorrowPicker() {
      this.showBorrowPicker = false;
      this.selectedBorrowPlayer = '';
      this.borrowSearch = '';
    },

    async addBorrow() {
      if (!this.selectedBorrowPlayer) return;
      try {
        await window.GTWData.addBorrowedPlayer(gameId, this.selectedBorrowPlayer, parseFloat(this.borrowWeight) || 0.5);
        this.cancelBorrowPicker();
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
      }
    },

    async updateBorrowWeight(borrow, weight) {
      try {
        const w = Math.max(0.1, Math.min(1.0, parseFloat(weight) || 0.5));
        await window.GTWData.updateBorrowedPlayer(borrow.id, { priority_weight: w });
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
      }
    },

    async removeBorrow(borrowId, playerName) {
      if (!confirm(`Remove ${playerName} as borrowed player for this game?`)) return;
      try {
        await window.GTWData.removeBorrowedPlayer(borrowId);
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
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

    // ============ AVAILABILITY ============

    availabilityFor(playerId) {
      return this.availabilities.find(a => a.player_id === playerId)?.status || null;
    },

    availabilityCount(status) {
      return this.availabilities.filter(a => a.status === status).length;
    },

    // Combined list: regulars (from roster, active only) + borrowed
    // Each entry: { player_id, full_name, jersey_no, is_borrowed, priority_weight, borrow_id (if borrowed) }
    allEligiblePlayers() {
      const regulars = this.roster
        .filter(m => m.is_active && m.player)
        .map(m => ({
          player_id: m.player.id,
          full_name: m.player.full_name,
          jersey_no: m.jersey_no,
          family_name: m.player.family?.family_name || null,
          is_borrowed: false,
          priority_weight: 1.0,
          borrow_id: null
        }));
      const borrowed = this.borrowedPlayers.map(b => ({
        player_id: b.player.id,
        full_name: b.player.full_name,
        jersey_no: null,                    // borrowed players don't have a jersey on this team
        family_name: b.player.family?.family_name || null,
        is_borrowed: true,
        priority_weight: parseFloat(b.priority_weight),
        borrow_id: b.id
      }));
      return [...regulars, ...borrowed];
    },

    unconfirmedCount() {
      const confirmedIds = new Set(this.availabilities.map(a => a.player_id));
      return this.allEligiblePlayers().filter(p => !confirmedIds.has(p.player_id)).length;
    },

    async setAvailability(playerId, status) {
      try {
        if (status === '') {
          await window.GTWData.clearAvailability(gameId, playerId);
        } else {
          await window.GTWData.upsertAvailability(gameId, playerId, status);
        }
        this.availabilities = await window.GTWData.listAvailabilities(gameId);
      } catch (err) {
        this.error = err.message;
      }
    },

    async markAllAvailable() {
      if (!confirm('Default all unconfirmed players (including borrowed) to "Available"?')) return;
      try {
        const confirmedIds = new Set(this.availabilities.map(a => a.player_id));
        for (const p of this.allEligiblePlayers()) {
          if (!confirmedIds.has(p.player_id)) {
            await window.GTWData.upsertAvailability(gameId, p.player_id, 'available');
          }
        }
        this.availabilities = await window.GTWData.listAvailabilities(gameId);
      } catch (err) {
        this.error = err.message;
      }
    },

    // ============ ROTATION ============

    isEqualOpportunity() {
      return this.game?.team?.rule_mode === 'equal_opportunity';
    },

    availablePlayers() {
      // All eligible players (regulars + borrowed) where availability=available
      return this.allEligiblePlayers().filter(p => this.availabilityFor(p.player_id) === 'available');
    },

    async generateRotationNow() {
      if (this.rotationPlan?.is_locked) {
        if (!confirm('Rotation plan is locked. Unlock and regenerate?')) return;
      } else if (this.rotationPlan) {
        if (!confirm('Regenerate rotation plan? Current plan will be replaced.')) return;
      }

      // Build the algorithm input — note priority_weight passes through (1.0 for regulars, <1 for borrowed)
      const players = this.availablePlayers().map(p => ({
        id: p.player_id,
        full_name: p.full_name,
        jersey_no: p.jersey_no,
        priority_weight: p.priority_weight,
        is_borrowed: p.is_borrowed
      }));

      if (players.length < 5) {
        this.error = `Need at least 5 available players to generate a rotation (currently ${players.length} confirmed available).`;
        return;
      }

      this.generatingRotation = true;
      this.error = '';
      try {
        const periods = this.game.periods ?? this.game.team.game_format_periods ?? 2;
        const minutesPerPeriod = this.game.minutes_per_period ?? this.game.team.game_format_minutes_per_period ?? 20;
        // Use team's configured block size (e.g. 5 for U10, 10 for quarter-locked)
        const blockSize = this.game.team.rotation_block_minutes ?? 2;

        const plan = window.GTWRotation.generate(players, periods, minutesPerPeriod, blockSize);
        await window.GTWData.saveRotationPlan(gameId, plan, false);
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.generatingRotation = false;
      }
    },

    async toggleRotationLock() {
      if (!this.rotationPlan) return;
      try {
        await window.GTWData.setRotationLock(this.rotationPlan.id, !this.rotationPlan.is_locked);
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
      }
    },

    async clearRotation() {
      if (!confirm('Delete the current rotation plan?')) return;
      try {
        await window.GTWData.deleteRotationPlan(gameId);
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
      }
    },

    rotationMatrix() {
      if (!this.rotationPlan?.plan) return null;
      const players = this.availablePlayers().map(p => ({
        id: p.player_id,
        full_name: p.full_name + (p.is_borrowed ? ' (borrowed)' : ''),
        jersey_no: p.jersey_no
      }));
      return window.GTWRotation.toMatrix(this.rotationPlan.plan, players);
    },

    minutesByPlayer() {
      return this.rotationPlan?.plan?.minutes_by_player || {};
    },

    printRotation() {
      window.print();
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
