// =====================================================================
// Dashboard view — club-wide summary + upcoming games
// =====================================================================
function dashboardView(currentClub, currentStaff, onNavigate) {
  return {
    loading: true,
    error: '',
    summary: null,

    async init() {
      try {
        this.summary = await window.GTWData.getDashboardSummary(currentClub.id);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    formatDate(d) {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    },

    formatTime(t) {
      if (!t) return '';
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
      return `${Math.abs(n)} days ago`;
    },

    daysClass(d) {
      const n = this.daysToGo(d);
      if (n === null) return 'text-slate-500';
      if (n <= 1) return 'text-brand-700 font-semibold';
      if (n <= 3) return 'text-brand-600';
      return 'text-slate-500';
    },

    openGame(g) {
      onNavigate('games', g.id);
    },

    goTo(route) {
      onNavigate(route);
    }
  };
}

window.dashboardView = dashboardView;
