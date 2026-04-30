// =====================================================================
// Game Time Wizard — Frontend app logic
// Vanilla JS + Alpine.js + Supabase. No build step.
// =====================================================================

// Singleton Supabase client (created once config is verified)
let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (!window.GTW_CONFIG?.SUPABASE_URL || !window.GTW_CONFIG?.SUPABASE_ANON) {
    return null;
  }
  _supabase = window.supabase.createClient(
    window.GTW_CONFIG.SUPABASE_URL,
    window.GTW_CONFIG.SUPABASE_ANON
  );
  return _supabase;
}

// =====================================================================
// Alpine root component
// =====================================================================
function app() {
  return {
    // ---- state ----
    configMissing: false,
    loading: true,
    session: null,
    route: 'dashboard',

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
      const sb = getSupabase();
      if (!sb) {
        this.configMissing = true;
        this.loading = false;
        return;
      }

      // Hydrate route from URL hash
      this.syncRouteFromHash();
      window.addEventListener('hashchange', () => this.syncRouteFromHash());

      // Check existing session
      const { data: { session } } = await sb.auth.getSession();
      this.session = session;
      this.loading = false;

      // Listen for auth state changes (magic link callback, sign out)
      sb.auth.onAuthStateChange((_event, newSession) => {
        this.session = newSession;
      });
    },

    // ---- routing ----
    syncRouteFromHash() {
      const hash = window.location.hash || '#/dashboard';
      const route = hash.replace(/^#\//, '').split('/')[0] || 'dashboard';
      this.route = this.nav.some(n => n.route === route) ? route : 'dashboard';
    },

    navigate(route) {
      this.route = route;
      window.location.hash = '#/' + route;
    },

    // ---- auth actions ----
    async sendMagicLink() {
      this.loginError = '';
      this.sending = true;
      try {
        const sb = getSupabase();
        const { error } = await sb.auth.signInWithOtp({
          email: this.loginEmail.trim(),
          options: {
            // Redirect back to this page after the magic link is clicked
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
      const sb = getSupabase();
      await sb.auth.signOut();
      this.session = null;
      this.magicLinkSent = false;
      this.loginEmail = '';
    }
  };
}

// Expose to global scope so Alpine can find it
window.app = app;
