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

    // Manual editing state — { blockIdx, playerId } when an on-court player is selected for swap
    selectedSwap: null,

    // Comms
    commTemplates: [],         // raw template rows
    commMessages: [],          // raw message rows for this game
    messageDrafts: {           // editable preview text keyed by message_type
      availability_request: '',
      logistics_reminder: '',
      game_day_notice: ''
    },
    showMessage: {             // expand/collapse state per card
      availability_request: false,
      logistics_reminder: false,
      game_day_notice: false
    },
    copying: '',               // message_type currently being copied (for spinner)
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
          this.loadAvailabilityAndRotation(),
          this.loadComms()
        ]);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async loadComms() {
      const [templates, messages] = await Promise.all([
        window.GTWData.listCommTemplates(currentClub.id),
        window.GTWData.listGameCommMessages(gameId)
      ]);
      this.commTemplates = templates;
      this.commMessages = messages;
      // Hydrate drafts from existing generated text
      for (const m of messages) {
        if (m.generated_text) this.messageDrafts[m.message_type] = m.generated_text;
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
    // Each entry: { player_id, full_name, jersey_no, positions, is_borrowed, priority_weight, borrow_id }
    allEligiblePlayers() {
      const regulars = this.roster
        .filter(m => m.is_active && m.player)
        .map(m => ({
          player_id: m.player.id,
          full_name: m.player.full_name,
          jersey_no: m.jersey_no,
          positions: m.positions || [],
          family_name: m.player.family?.family_name || null,
          is_borrowed: false,
          priority_weight: 1.0,
          borrow_id: null
        }));
      const borrowed = this.borrowedPlayers.map(b => ({
        player_id: b.player.id,
        full_name: b.player.full_name,
        jersey_no: null,                    // borrowed players don't have a jersey on this team
        positions: [],                      // borrowed don't bring positions from elsewhere
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
        full_name: p.full_name,
        jersey_no: p.jersey_no,
        positions: p.positions,
        is_borrowed: p.is_borrowed
      }));
      return window.GTWRotation.toMatrix(this.rotationPlan.plan, players);
    },

    // For a given block index, summarise positions on court — e.g. "PG 2SG SF C" or "PG 2SG ?"
    positionSummaryForBlock(blockIdx) {
      if (!this.rotationPlan) return '—';
      const loc = this.locateBlock(blockIdx);
      if (!loc || loc.block.on_court.length === 0) return '—';
      const allPlayers = this.availablePlayers();
      const counts = {};
      for (const playerId of loc.block.on_court) {
        const p = allPlayers.find(x => x.player_id === playerId);
        if (!p || !p.positions || p.positions.length === 0) {
          counts['?'] = (counts['?'] || 0) + 1;
          continue;
        }
        const pos = p.positions[0];   // primary position
        counts[pos] = (counts[pos] || 0) + 1;
      }
      const order = ['G', 'F', 'C', '?'];
      return order
        .filter(pos => counts[pos])
        .map(pos => counts[pos] > 1 ? `${counts[pos]}${pos}` : pos)
        .join(' ');
    },

    minutesByPlayer() {
      return this.rotationPlan?.plan?.minutes_by_player || {};
    },

    printRotation() {
      window.print();
    },

    // ============ MANUAL ROTATION EDITING ============

    // Build an empty plan (for senior teams or when starting fresh)
    async startEmptyPlan() {
      if (this.rotationPlan) {
        if (!confirm('Replace existing plan with an empty one?')) return;
      }
      try {
        const periods = this.game.periods ?? this.game.team.game_format_periods ?? 2;
        const minutesPerPeriod = this.game.minutes_per_period ?? this.game.team.game_format_minutes_per_period ?? 20;
        const blockSize = this.game.team.rotation_block_minutes ?? 2;

        const periodsOut = [];
        for (let p = 0; p < periods; p++) {
          const blocks = [];
          let from = 0;
          while (from < minutesPerPeriod) {
            const to = Math.min(from + blockSize, minutesPerPeriod);
            blocks.push({ from, to, on_court: [] });
            from = to;
          }
          periodsOut.push({ minute_blocks: blocks });
        }

        const plan = {
          version: 1,
          generated_at: new Date().toISOString(),
          format: { periods, minutes_per_period: minutesPerPeriod, block_size: blockSize },
          players_count: 0,
          periods: periodsOut,
          minutes_by_player: {}
        };
        await window.GTWData.saveRotationPlan(gameId, plan, false);
        await this.loadAvailabilityAndRotation();
      } catch (err) {
        this.error = err.message;
      }
    },

    // Find period + local block for a global block index
    locateBlock(globalBlockIdx) {
      let cum = 0;
      for (let p = 0; p < this.rotationPlan.plan.periods.length; p++) {
        const blocks = this.rotationPlan.plan.periods[p].minute_blocks;
        if (cum + blocks.length > globalBlockIdx) {
          return { periodIdx: p, localIdx: globalBlockIdx - cum, block: blocks[globalBlockIdx - cum] };
        }
        cum += blocks.length;
      }
      return null;
    },

    isCellSelected(blockIdx, playerId) {
      return this.selectedSwap?.blockIdx === blockIdx && this.selectedSwap?.playerId === playerId;
    },

    // True if this column is the active swap target (off-court cells should highlight)
    isSwapTargetColumn(blockIdx) {
      if (this.selectedSwap?.blockIdx === blockIdx) return true;
      // Or block has space (< 5 on court)
      const loc = this.rotationPlan ? this.locateBlock(blockIdx) : null;
      return loc && loc.block.on_court.length < 5;
    },

    cancelSwap() {
      this.selectedSwap = null;
    },

    async clickCell(blockIdx, playerId, isOnCourt) {
      if (!this.canEdit() || !this.rotationPlan) return;

      if (isOnCourt) {
        // Toggle selection
        if (this.isCellSelected(blockIdx, playerId)) {
          this.selectedSwap = null;
        } else {
          this.selectedSwap = { blockIdx, playerId };
        }
        return;
      }

      // Off-court click
      const loc = this.locateBlock(blockIdx);
      if (!loc) return;

      if (loc.block.on_court.length < 5) {
        // Block has space — just add this player
        await this.applyEdit(plan => {
          const b = plan.periods[loc.periodIdx].minute_blocks[loc.localIdx];
          if (!b.on_court.includes(playerId)) b.on_court.push(playerId);
        });
      } else if (this.selectedSwap?.blockIdx === blockIdx) {
        // Block full + we have a swap target — swap them
        const outId = this.selectedSwap.playerId;
        await this.applyEdit(plan => {
          const b = plan.periods[loc.periodIdx].minute_blocks[loc.localIdx];
          const idx = b.on_court.indexOf(outId);
          if (idx >= 0) b.on_court[idx] = playerId;
        });
        this.selectedSwap = null;
      }
      // Else (block full, no swap target): silently ignore — UI hint should make this obvious
    },

    async removeFromBlock(blockIdx, playerId) {
      if (!this.canEdit() || !this.rotationPlan) return;
      const loc = this.locateBlock(blockIdx);
      if (!loc) return;
      await this.applyEdit(plan => {
        const b = plan.periods[loc.periodIdx].minute_blocks[loc.localIdx];
        b.on_court = b.on_court.filter(id => id !== playerId);
      });
      if (this.isCellSelected(blockIdx, playerId)) this.selectedSwap = null;
    },

    // ============ COMMS ============

    commTemplate(messageType) {
      return this.commTemplates.find(t => t.message_type === messageType)?.template || '';
    },

    commMessage(messageType) {
      return this.commMessages.find(m => m.message_type === messageType) || null;
    },

    isMessageSent(messageType) {
      return !!this.commMessage(messageType)?.copied_at;
    },

    messageStatusLabel(messageType) {
      const m = this.commMessage(messageType);
      if (!m) return 'Not generated yet';
      if (m.copied_at) return 'Sent · ' + new Date(m.copied_at).toLocaleString('en-AU');
      return 'Generated · not yet copied';
    },

    // Build the token context for the current game state
    buildCommsContext() {
      const players = this.availablePlayers().map(p => ({
        id: p.player_id,
        full_name: p.full_name + (p.is_borrowed ? ' (borrowed)' : '')
      }));
      const unconfirmedNames = this.allEligiblePlayers()
        .filter(p => !this.availabilityFor(p.player_id))
        .map(p => '- ' + p.full_name)
        .join('\n');
      return window.GTWComms.buildContext({
        game: this.game,
        dutyAssignment: this.dutyAssignment,
        rotationPlan: this.rotationPlan,
        players: players,
        availableCount: this.availabilityCount('available'),
        unconfirmedList: unconfirmedNames || '(none)'
      });
    },

    generateMessage(messageType) {
      const tpl = this.commTemplate(messageType);
      if (!tpl) {
        this.error = 'No template configured for ' + messageType + '. Set one in Settings → Comms.';
        return;
      }
      const ctx = this.buildCommsContext();
      const rendered = window.GTWComms.render(tpl, ctx);
      this.messageDrafts[messageType] = rendered;
      this.showMessage[messageType] = true;
    },

    async copyMessage(messageType) {
      this.copying = messageType;
      this.error = '';
      try {
        const text = this.messageDrafts[messageType];
        if (!text) {
          this.error = 'No message text to copy. Click Generate first.';
          return;
        }
        // Save the text first
        await window.GTWData.upsertCommMessage(gameId, messageType, text);
        // Refresh to get the row id, then mark copied
        const messages = await window.GTWData.listGameCommMessages(gameId);
        this.commMessages = messages;
        const saved = this.commMessage(messageType);
        if (saved) {
          // Try to copy to clipboard
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          }
          await window.GTWData.markCommMessageCopied(saved.id);
          this.commMessages = await window.GTWData.listGameCommMessages(gameId);
        }
      } catch (err) {
        this.error = 'Copy failed: ' + err.message + '. You can still select the text and copy manually.';
      } finally {
        this.copying = '';
      }
    },

    async clearMessage(messageType) {
      if (!confirm('Clear this message and reset its sent status?')) return;
      try {
        await window.GTWData.clearCommMessage(gameId, messageType);
        this.messageDrafts[messageType] = '';
        this.showMessage[messageType] = false;
        this.commMessages = await window.GTWData.listGameCommMessages(gameId);
      } catch (err) {
        this.error = err.message;
      }
    },

    // Apply a mutation to the plan, recompute minutes, save
    async applyEdit(mutator) {
      try {
        const plan = JSON.parse(JSON.stringify(this.rotationPlan.plan));
        mutator(plan);
        // Recompute minutes_by_player from blocks
        const minutes = {};
        for (const period of plan.periods) {
          for (const b of period.minute_blocks) {
            const dur = b.to - b.from;
            for (const pid of b.on_court) {
              minutes[pid] = (minutes[pid] || 0) + dur;
            }
          }
        }
        plan.minutes_by_player = minutes;
        plan.players_count = Object.keys(minutes).length;
        await window.GTWData.saveRotationPlan(gameId, plan, this.rotationPlan.is_locked);
        await this.loadAvailabilityAndRotation();
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
