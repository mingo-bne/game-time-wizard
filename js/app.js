// =====================================================================
// Game Time Wizard — Frontend app logic
// Vanilla JS + Alpine.js + Supabase. No build step.
// =====================================================================

// =====================================================================
// Alpine root component
// =====================================================================
function app() {
  return {
    // ---- state ----
    configMissing: false,
    loading: true,
    session: null,
    currentStaff: null,
    currentClub: null,
    accessDenied: false,

    // routing
    route: 'dashboard',
    subroute: null,        // e.g. team UUID for #/teams/<uuid>

    // login form
    loginEmail: '',
    sending: false,
    magicLinkSent: false,
    loginError: '',

    // navigation
    nav: [
      { route: 'dashboard', label: 'Dashboard', icon: '📋' },
      { route: 'teams',     label: 'Teams',     icon: '👥' },
      { route: 'roster',    label: 'Roster',    icon: '🏀' },
      { route: 'games',     label: 'Games',     icon: '📅' },
      { route: 'settings',  label: 'Settings',  icon: '⚙️' }
    ],

    // ---- lifecycle ----
    async init() {
      // Check config
      if (!window.GTW_CONFIG?.SUPABASE_URL || !window.GTW_CONFIG?.SUPABASE_ANON) {
        this.configMissing = true;
        this.loading = false;
        return;
      }

      // Hydrate route from URL hash
      this.syncRouteFromHash();
      window.addEventListener('hashchange', () => this.syncRouteFromHash());

      const sb = window.GTWData.sb();

      // Check existing session
      const { data: { session } } = await sb.auth.getSession();
      this.session = session;
      if (this.session) await this.loadStaffContext();
      this.loading = false;

      // Listen for auth state changes (magic link callback, sign out)
      sb.auth.onAuthStateChange(async (_event, newSession) => {
        const wasSignedIn = !!this.session;
        this.session = newSession;
        if (newSession && !wasSignedIn) {
          this.loading = true;
          await this.loadStaffContext();
          this.loading = false;
        }
        if (!newSession) {
          this.currentStaff = null;
          this.currentClub = null;
          this.accessDenied = false;
        }
      });
    },

    async loadStaffContext() {
      try {
        this.currentStaff = await window.GTWData.getCurrentStaff();
        if (!this.currentStaff) {
          this.accessDenied = true;
          this.currentClub = null;
          return;
        }
        this.accessDenied = false;
        this.currentClub = await window.GTWData.getClub(this.currentStaff.club_id);
      } catch (err) {
        console.error('Failed to load staff context:', err);
        this.accessDenied = true;
      }
    },

    // ---- routing ----
    syncRouteFromHash() {
      const hash = window.location.hash || '#/dashboard';
      const parts = hash.replace(/^#\//, '').split('/');
      const route = parts[0] || 'dashboard';
      this.route = this.nav.some(n => n.route === route) ? route : 'dashboard';
      this.subroute = parts[1] || null;
    },

    navigate(route, subroute) {
      this.route = route;
      this.subroute = subroute || null;
      window.location.hash = subroute
        ? `#/${route}/${subroute}`
        : `#/${route}`;
    },

    // ---- auth actions ----
    async sendMagicLink() {
      this.loginError = '';
      this.sending = true;
      try {
        const sb = window.GTWData.sb();
        const { error } = await sb.auth.signInWithOtp({
          email: this.loginEmail.trim(),
          options: {
            emailRedirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) throw error;
        this.magicLinkSent = true;
      } catch (err) {
        this.loginError = err.message || 'Failed to send magic link.';
      } finally {
        this.sending = false;
      }
    },

    async signOut() {
      const sb = window.GTWData.sb();
      await sb.auth.signOut();
      this.session = null;
      this.magicLinkSent = false;
      this.loginEmail = '';
      window.location.hash = '#/dashboard';
    }
  };
}

window.app = app;
