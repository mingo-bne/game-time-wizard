// =====================================================================
// Ratings view — per-team player ratings (11 sub-skills × 1–5)
// =====================================================================

const RATING_CATEGORIES = [
  {
    key: 'physical', label: 'Physical', max: 20,
    skills: [
      { key: 'phy_speed',    label: 'Speed' },
      { key: 'phy_strength', label: 'Strength' },
      { key: 'phy_size',     label: 'Size' },
      { key: 'phy_fitness',  label: 'Fitness' }
    ]
  },
  {
    key: 'core_skills', label: 'Core Skills', max: 25,
    skills: [
      { key: 'cs_shooting',      label: 'Shooting' },
      { key: 'cs_ball_handling', label: 'Ball Handling' },
      { key: 'cs_passing',       label: 'Passing' },
      { key: 'cs_defence',       label: 'Defence' },
      { key: 'cs_rebounding',    label: 'Rebounding' }
    ]
  },
  {
    key: 'basketball_iq', label: 'Basketball IQ', max: 10,
    skills: [
      { key: 'iq_court_awareness', label: 'Court Awareness' },
      { key: 'iq_decision_making', label: 'Decision Making' }
    ]
  }
];

const ALL_SKILL_KEYS = RATING_CATEGORIES.flatMap(c => c.skills.map(s => s.key));

function ratingsView(currentClub, currentStaff) {
  return {
    loading: true,
    saving: false,
    error: '',
    teams: [],
    selectedTeamId: '',
    isHeadCoach: false,

    // Roster (memberships joined with players)
    roster: [],
    // ratings keyed by player_id → rating row
    ratingsByPlayer: {},
    // Form drafts keyed by player_id → editable copy
    drafts: {},
    // Which player card is expanded
    expandedPlayerId: null,

    RATING_CATEGORIES,

    async init() {
      try {
        this.teams = await window.GTWData.listMyEditableTeams(currentClub.id, currentStaff);
        const last = localStorage.getItem('gtw_last_team');
        if (last && this.teams.some(t => t.id === last)) {
          this.selectedTeamId = last;
        } else if (this.teams.length > 0) {
          this.selectedTeamId = this.teams[0].id;
        }
        if (this.selectedTeamId) await this.loadAll();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async onTeamChange() {
      localStorage.setItem('gtw_last_team', this.selectedTeamId);
      this.expandedPlayerId = null;
      await this.loadAll();
    },

    async loadAll() {
      this.error = '';
      try {
        const [roster, ratings, isHC] = await Promise.all([
          window.GTWData.listTeamRoster(this.selectedTeamId),
          window.GTWData.listRatingsForTeam(this.selectedTeamId),
          window.GTWData.isHeadCoachOfTeam(this.selectedTeamId, currentStaff.id)
        ]);
        this.roster = roster;
        this.isHeadCoach = isHC;
        this.ratingsByPlayer = {};
        for (const r of ratings) this.ratingsByPlayer[r.player_id] = r;
        this.drafts = {};   // reset drafts
      } catch (err) {
        this.error = err.message;
      }
    },

    canEdit() {
      // The team's Coach can edit; club admins (Coordinator / Head Coach,
      // both reflected in currentStaff.is_admin via the ADR-024 trigger)
      // can edit on any team.
      return this.isHeadCoach || !!currentStaff?.is_admin;
    },

    selectedTeamName() {
      return this.teams.find(t => t.id === this.selectedTeamId)?.name || '';
    },

    // ---- per-player helpers ----
    rating(playerId) {
      return this.ratingsByPlayer[playerId] || null;
    },

    isRated(playerId) {
      return !!this.ratingsByPlayer[playerId];
    },

    getDraft(playerId) {
      if (this.drafts[playerId]) return this.drafts[playerId];
      const existing = this.rating(playerId);
      const fresh = {};
      for (const k of ALL_SKILL_KEYS) fresh[k] = existing?.[k] ?? 3;   // default 3
      fresh.notes = existing?.notes ?? '';
      this.drafts[playerId] = fresh;
      return fresh;
    },

    categorySum(playerOrDraft, categoryKey) {
      if (!playerOrDraft) return 0;
      const cat = RATING_CATEGORIES.find(c => c.key === categoryKey);
      return cat.skills.reduce((sum, s) => sum + (playerOrDraft[s.key] || 0), 0);
    },

    categoryAvg(playerOrDraft, categoryKey) {
      if (!playerOrDraft) return 0;
      const cat = RATING_CATEGORIES.find(c => c.key === categoryKey);
      const sum = this.categorySum(playerOrDraft, categoryKey);
      return (sum / cat.skills.length).toFixed(1);
    },

    totalSum(playerOrDraft) {
      if (!playerOrDraft) return 0;
      return ALL_SKILL_KEYS.reduce((sum, k) => sum + (playerOrDraft[k] || 0), 0);
    },

    totalAvg(playerOrDraft) {
      if (!playerOrDraft) return 0;
      return (this.totalSum(playerOrDraft) / ALL_SKILL_KEYS.length).toFixed(1);
    },

    // Team-level: average of all rated players' totalAvg
    teamSummary() {
      const rated = Object.values(this.ratingsByPlayer);
      if (rated.length === 0) return null;
      const totalAvgs = rated.map(r => parseFloat(this.totalAvg(r)));
      const avg = totalAvgs.reduce((s, v) => s + v, 0) / rated.length;
      return {
        rated: rated.length,
        unrated: this.roster.length - rated.length,
        teamAvg: avg.toFixed(1)
      };
    },

    // ---- expand/collapse ----
    toggleExpand(playerId) {
      this.expandedPlayerId = this.expandedPlayerId === playerId ? null : playerId;
    },

    isExpanded(playerId) {
      return this.expandedPlayerId === playerId;
    },

    // ---- save ----
    async saveRating(playerId) {
      if (!this.canEdit()) return;
      const draft = this.drafts[playerId];
      if (!draft) return;
      this.saving = true;
      this.error = '';
      try {
        const saved = await window.GTWData.upsertRating(playerId, this.selectedTeamId, draft);
        this.ratingsByPlayer[playerId] = saved;
        delete this.drafts[playerId];
        this.expandedPlayerId = null;
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    cancelEdit(playerId) {
      delete this.drafts[playerId];
      this.expandedPlayerId = null;
    },

    async clearRating(playerId, playerName) {
      if (!this.canEdit()) return;
      if (!confirm(`Clear all ratings for ${playerName}? They become "unrated" again.`)) return;
      try {
        await window.GTWData.deleteRating(playerId, this.selectedTeamId);
        delete this.ratingsByPlayer[playerId];
        delete this.drafts[playerId];
        this.expandedPlayerId = null;
      } catch (err) {
        this.error = err.message;
      }
    },

    setSkill(playerId, skillKey, value) {
      const draft = this.getDraft(playerId);
      draft[skillKey] = value;
    }
  };
}

window.ratingsView = ratingsView;
