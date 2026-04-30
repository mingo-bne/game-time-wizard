// =====================================================================
// Settings view — Club + Staff tabs
// =====================================================================
const MESSAGE_TYPE_LABELS = {
  availability_request: 'Day -7 — Availability request',
  logistics_reminder:   'Day -2 — Logistics + bench duty reminder',
  game_day_notice:      'Day -1 — Game day notice (with rotation)'
};

const ALL_TOKENS_HELP = [
  '{{team_name}}', '{{game_date}}', '{{game_time}}',
  '{{venue}}', '{{court}}', '{{opposition}}',
  '{{duty_family}}', '{{rotation_chart}}',
  '{{available_count}}', '{{unconfirmed_list}}'
];

function settingsView(currentClub, currentStaff) {
  return {
    tab: 'club',           // 'club' | 'staff' | 'comms' | 'account'
    loading: true,
    saving: false,
    error: '',

    // club
    clubName: '',

    // staff list
    staffList: [],
    showAddStaff: false,
    newStaff: { full_name: '', email: '', is_admin: false },
    editingStaffId: null,
    resetSendingFor: null,           // staff.id while a password-reset email is sending
    resetSentFor: null,              // staff.id we just successfully sent a reset to (3s flash)

    // my account / change password
    pwdNew: '',
    pwdConfirm: '',
    pwdSaving: false,
    pwdSavedFlash: false,
    pwdError: '',

    // comm templates
    commTemplates: [],
    templateDrafts: {},
    templateSavingType: '',          // which template is currently saving (for spinner)
    templateSavedFlash: '',          // shows ✓ briefly after save
    MESSAGE_TYPE_LABELS,
    ALL_TOKENS_HELP,

    async init() {
      this.clubName = currentClub?.name || '';
      await Promise.all([this.loadStaff(), this.loadTemplates()]);
      this.loading = false;
    },

    async loadTemplates() {
      try {
        this.commTemplates = await window.GTWData.listCommTemplates(currentClub.id);
        this.templateDrafts = {};
        for (const t of this.commTemplates) this.templateDrafts[t.message_type] = t.template;
        // Ensure all three message types have a draft entry (even if no template row exists yet)
        for (const mt of Object.keys(MESSAGE_TYPE_LABELS)) {
          if (!(mt in this.templateDrafts)) this.templateDrafts[mt] = '';
        }
      } catch (err) {
        this.error = err.message;
      }
    },

    async saveTemplate(messageType) {
      this.error = '';
      this.templateSavingType = messageType;
      this.templateSavedFlash = '';
      try {
        const draft = this.templateDrafts[messageType] || '';
        if (!draft.trim()) {
          this.error = 'Template cannot be empty.';
          return;
        }
        await window.GTWData.upsertCommTemplate(currentClub.id, messageType, draft);
        await this.loadTemplates();
        this.templateSavedFlash = messageType;
        // Clear the green "Saved ✓" indicator after 3 seconds
        setTimeout(() => {
          if (this.templateSavedFlash === messageType) this.templateSavedFlash = '';
        }, 3000);
      } catch (err) {
        // Surface the most useful info we can — RLS errors come through with a useful message
        this.error = 'Save failed: ' + (err.message || String(err)) +
          (err.message?.includes('row-level security') ? ' — your staff record may not have admin rights. Check is_admin = true in the staff table.' : '');
      } finally {
        this.templateSavingType = '';
      }
    },

    isAdmin() {
      return currentStaff?.is_admin === true;
    },

    // ---- club ----
    async saveClub() {
      this.error = '';
      this.saving = true;
      try {
        const updated = await window.GTWData.updateClub(currentClub.id, { name: this.clubName.trim() });
        currentClub.name = updated.name;
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    // ---- staff ----
    async loadStaff() {
      this.error = '';
      try {
        this.staffList = await window.GTWData.listStaff(currentClub.id);
      } catch (err) {
        this.error = err.message;
      }
    },

    pendingLabel(s) {
      return s.user_id ? '' : '(invited, not yet signed in)';
    },

    startAdd() {
      this.newStaff = { full_name: '', email: '', club_role: '' };  // '' = no club-wide role (team-only access)
      this.showAddStaff = true;
    },

    async addStaff() {
      this.error = '';
      if (!this.newStaff.full_name.trim() || !this.newStaff.email.trim()) {
        this.error = 'Name and email are both required.';
        return;
      }
      this.saving = true;
      try {
        await window.GTWData.createPendingStaff(currentClub.id, {
          full_name: this.newStaff.full_name.trim(),
          email:     this.newStaff.email.trim().toLowerCase(),
          club_role: this.newStaff.club_role || null
        });
        this.showAddStaff = false;
        await this.loadStaff();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    // Update a staff member's club-wide role.
    //   newRole: '' (no club role — team-only access) | 'coordinator' | 'head_coach'
    // The DB trigger sync_is_admin_with_club_role keeps staff.is_admin in
    // step automatically, so RLS policies based on is_admin continue to work.
    async setClubRole(s, newRole) {
      if (s.id === currentStaff.id && !newRole) {
        if (!confirm("Removing your own club role will lock you out of club-wide settings. Continue?")) return;
      }
      try {
        await window.GTWData.updateStaff(s.id, { club_role: newRole || null });
        await this.loadStaff();
      } catch (err) {
        this.error = err.message;
      }
    },

    clubRoleLabel(role) {
      if (role === 'coordinator') return 'Club Coordinator';
      if (role === 'head_coach')  return 'Club Head Coach';
      return '—';
    },

    async removeStaff(s) {
      if (s.id === currentStaff.id) {
        alert("You can't remove yourself.");
        return;
      }
      if (!confirm(`Remove ${s.full_name} from the club? This also removes them from any teams.`)) return;
      try {
        await window.GTWData.removeStaff(s.id);
        await this.loadStaff();
      } catch (err) {
        this.error = err.message;
      }
    },

    inviteUrl() {
      return window.location.origin + window.location.pathname;
    },

    // ---- My account: change own password ----
    async changePassword() {
      this.pwdError = '';
      this.pwdSavedFlash = false;

      if (!this.pwdNew || this.pwdNew.length < 8) {
        this.pwdError = 'Password must be at least 8 characters.';
        return;
      }
      if (this.pwdNew !== this.pwdConfirm) {
        this.pwdError = 'Passwords do not match.';
        return;
      }

      this.pwdSaving = true;
      try {
        const sb = window.GTWData.sb();
        const { error } = await sb.auth.updateUser({ password: this.pwdNew });
        if (error) throw error;
        this.pwdNew = '';
        this.pwdConfirm = '';
        this.pwdSavedFlash = true;
        setTimeout(() => { this.pwdSavedFlash = false; }, 4000);
      } catch (err) {
        this.pwdError = err.message || 'Failed to update password.';
      } finally {
        this.pwdSaving = false;
      }
    },

    // ---- Admin: send a password-reset email to a staff member ----
    // Uses Supabase's public resetPasswordForEmail — no admin API needed.
    // The recipient gets an email with a link that lets them set a new password.
    async sendPasswordReset(s) {
      if (!this.isAdmin()) return;
      if (!s.email) {
        this.error = 'No email on file for this staff member.';
        return;
      }
      this.error = '';
      this.resetSendingFor = s.id;
      try {
        const sb = window.GTWData.sb();
        const { error } = await sb.auth.resetPasswordForEmail(s.email, {
          redirectTo: window.location.origin + window.location.pathname
        });
        if (error) throw error;
        this.resetSentFor = s.id;
        setTimeout(() => {
          if (this.resetSentFor === s.id) this.resetSentFor = null;
        }, 4000);
      } catch (err) {
        this.error = `Failed to send reset email: ${err.message || err}`;
      } finally {
        this.resetSendingFor = null;
      }
    }
  };
}

window.settingsView = settingsView;
