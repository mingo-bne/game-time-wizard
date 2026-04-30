// =====================================================================
// Settings view — Club + Staff tabs
// =====================================================================
function settingsView(currentClub, currentStaff) {
  return {
    tab: 'club',           // 'club' | 'staff'
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

    async init() {
      this.clubName = currentClub?.name || '';
      await this.loadStaff();
      this.loading = false;
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
