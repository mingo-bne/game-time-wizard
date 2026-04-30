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
    tab: 'club',           // 'club' | 'staff' | 'comms'
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
      this.newStaff = { full_name: '', email: '', is_admin: false };
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
          is_admin:  this.newStaff.is_admin
        });
        this.showAddStaff = false;
        await this.loadStaff();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.saving = false;
      }
    },

    async toggleAdmin(s) {
      try {
        await window.GTWData.updateStaff(s.id, { is_admin: !s.is_admin });
        await this.loadStaff();
      } catch (err) {
        this.error = err.message;
      }
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
    }
  };
}

window.settingsView = settingsView;
