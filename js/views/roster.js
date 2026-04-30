// =====================================================================
// Roster view — Players (team memberships) + Families (club-level)
// =====================================================================
// Simplified positions for junior basketball — coach thinks in G/F/C, not pro basketball's PG/SG/SF/PF/C.
// Labels in the picker include the full word for clarity.
const POSITION_OPTIONS = ['G', 'F', 'C'];
const POSITION_LABELS = { G: 'Guard', F: 'Forward', C: 'Center' };
const RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Guardian', 'Step-parent', 'Other'];

function rosterView(currentClub, currentStaff) {
  return {
    loading: true,
    error: '',
    tab: 'players',

    teams: [],
    selectedTeamId: '',

    // Team roster (memberships joined with player data)
    roster: [],
    // All players in the club (for the "add existing" picker)
    clubPlayers: [],
    // All families in the club
    families: [],

    // Forms
    showNewPlayerForm: false,
    showExistingPlayerForm: false,
    editingMembership: null,             // the membership being edited
    showFamilyForm: false,
    editingFamily: null,
    showContactForm: null,               // family_id when adding a contact

    newPlayerForm: emptyNewPlayerForm(),
    existingPlayerForm: emptyExistingPlayerForm(),
    editForm: emptyEditForm(),
    familyForm: emptyFamilyForm(),
    contactForm: emptyContactForm(),

    POSITION_OPTIONS,
    POSITION_LABELS,
    RELATIONSHIP_OPTIONS,

    async init() {
      try {
        this.teams = await window.GTWData.listMyEditableTeams(currentClub.id, currentStaff);
        const last = localStorage.getItem('gtw_last_team');
        if (last && this.teams.some(t => t.id === last)) {
          this.selectedTeamId = last;
        } else if (this.teams.length > 0) {
          this.selectedTeamId = this.teams[0].id;
        }
        await this.loadCommon();
        if (this.selectedTeamId) await this.loadRoster();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async onTeamChange() {
      localStorage.setItem('gtw_last_team', this.selectedTeamId);
      this.cancelAllForms();
      await this.loadRoster();
    },

    async loadCommon() {
      this.error = '';
      const [families, clubPlayers] = await Promise.all([
        window.GTWData.listFamilies(currentClub.id),
        window.GTWData.listClubPlayers(currentClub.id)
      ]);
      this.families = families;
      this.clubPlayers = clubPlayers;
    },

    async loadRoster() {
      try {
        this.roster = await window.GTWData.listTeamRoster(this.selectedTeamId);
        // Refresh clubPlayers too so picker reflects newly created players
        this.clubPlayers = await window.GTWData.listClubPlayers(currentClub.id);
      } catch (err) {
        this.error = err.message;
      }
    },

    canEdit() {
      if (currentStaff?.is_admin) return true;
      return this.teams.some(t => t.id === this.selectedTeamId);
    },

    selectedTeamName() {
      return this.teams.find(t => t.id === this.selectedTeamId)?.name || '';
    },

    cancelAllForms() {
      this.showNewPlayerForm = false;
      this.showExistingPlayerForm = false;
      this.editingMembership = null;
      this.showFamilyForm = false;
      this.editingFamily = null;
      this.showContactForm = null;
    },

    // ============================================================
    // PLAYERS TAB
    // ============================================================

    age(p) {
      const dob = p?.dob;
      if (!dob) return '—';
      const d = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - d.getFullYear();
      if (today.getMonth() < d.getMonth() ||
          (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
      return age;
    },

    positionsLabel(m) {
      return (m.positions || []).join(', ') || '—';
    },

    otherTeams(player) {
      // Show OTHER teams this player is on (not the currently selected one)
      return (player?.team_memberships || [])
        .filter(m => m.team_id !== this.selectedTeamId && m.team)
        .map(m => m.team.name);
    },

    unrosteredClubPlayers() {
      const rosteredIds = new Set(this.roster.map(m => m.player_id));
      return this.clubPlayers.filter(p => !rosteredIds.has(p.id));
    },

    // ---- Add NEW player (creates club player + membership) ----
    startNewPlayer() {
      this.cancelAllForms();
      this.newPlayerForm = emptyNewPlayerForm();
      this.showNewPlayerForm = true;
    },

    togglePosition(form, pos) {
      const idx = form.positions.indexOf(pos);
      if (idx >= 0) form.positions.splice(idx, 1);
      else form.positions.push(pos);
    },

    async saveNewPlayer() {
      this.error = '';
      const f = this.newPlayerForm;
      if (!f.full_name?.trim()) {
        this.error = 'Player name is required.';
        return;
      }
      try {
        const player = await window.GTWData.createClubPlayer(currentClub.id, {
          full_name: f.full_name.trim(),
          dob: f.dob || null,
          family_id: f.family_id || null,
          photo_url: f.photo_url?.trim() || null
        });
        await window.GTWData.createMembership(this.selectedTeamId, player.id, {
          jersey_no: f.jersey_no === '' ? null : parseInt(f.jersey_no, 10),
          positions: f.positions.length ? f.positions : null,
          is_active: !!f.is_active
        });
        this.cancelAllForms();
        await this.loadRoster();
      } catch (err) {
        this.error = err.message;
      }
    },

    // ---- Add EXISTING club player to this team ----
    startAddExisting() {
      this.cancelAllForms();
      const candidates = this.unrosteredClubPlayers();
      this.existingPlayerForm = {
        player_id: candidates[0]?.id || '',
        jersey_no: '',
        positions: [],
        is_active: true
      };
      this.showExistingPlayerForm = true;
    },

    async saveAddExisting() {
      this.error = '';
      const f = this.existingPlayerForm;
      if (!f.player_id) {
        this.error = 'Pick a player.';
        return;
      }
      try {
        await window.GTWData.createMembership(this.selectedTeamId, f.player_id, {
          jersey_no: f.jersey_no === '' ? null : parseInt(f.jersey_no, 10),
          positions: f.positions.length ? f.positions : null,
          is_active: !!f.is_active
        });
        this.cancelAllForms();
        await this.loadRoster();
      } catch (err) {
        this.error = err.message;
      }
    },

    // ---- Edit existing membership (per-team) AND player (club-level) ----
    startEditMembership(m) {
      this.cancelAllForms();
      this.editingMembership = m;
      this.editForm = {
        // player-level
        full_name: m.player?.full_name || '',
        dob: m.player?.dob || '',
        family_id: m.player?.family?.id || '',
        photo_url: m.player?.photo_url || '',
        // team-level
        jersey_no: m.jersey_no ?? '',
        positions: [...(m.positions || [])],
        is_active: m.is_active
      };
    },

    async saveEdit() {
      this.error = '';
      const f = this.editForm;
      if (!f.full_name?.trim()) {
        this.error = 'Player name is required.';
        return;
      }
      try {
        // Update club-level player record
        await window.GTWData.updatePlayer(this.editingMembership.player_id, {
          full_name: f.full_name.trim(),
          dob: f.dob || null,
          family_id: f.family_id || null,
          photo_url: f.photo_url?.trim() || null
        });
        // Update per-team membership
        await window.GTWData.updateMembership(this.editingMembership.id, {
          jersey_no: f.jersey_no === '' ? null : parseInt(f.jersey_no, 10),
          positions: f.positions.length ? f.positions : null,
          is_active: !!f.is_active
        });
        this.cancelAllForms();
        await this.loadRoster();
      } catch (err) {
        this.error = err.message;
      }
    },

    async removeFromTeam(m) {
      if (!confirm(`Remove ${m.player?.full_name} from ${this.selectedTeamName()}? They stay in the club and on any other teams.`)) return;
      try {
        await window.GTWData.removeMembership(m.id);
        await this.loadRoster();
      } catch (err) {
        this.error = err.message;
      }
    },

    async deletePlayerFromClub(m) {
      const onTeams = (m.player?.team_memberships?.length || 0);
      const msg = onTeams > 1
        ? `Delete ${m.player?.full_name} from the ENTIRE CLUB? They are on ${onTeams} teams. All ratings, history, attendance will be lost. Cannot be undone.`
        : `Delete ${m.player?.full_name} from the club entirely? All ratings, history, attendance will be lost. Cannot be undone.`;
      if (!confirm(msg)) return;
      try {
        await window.GTWData.deletePlayer(m.player_id);
        await this.loadRoster();
      } catch (err) {
        this.error = err.message;
      }
    },

    // ============================================================
    // FAMILIES TAB (club-level)
    // ============================================================

    contactSummary(f) {
      const cs = f.family_contacts || [];
      if (cs.length === 0) return 'No contacts';
      return cs.map(c => `${c.name}${c.relationship ? ` (${c.relationship})` : ''}`).join(' · ');
    },

    startNewFamily() {
      this.cancelAllForms();
      this.familyForm = emptyFamilyForm();
      this.showFamilyForm = true;
    },

    startEditFamily(f) {
      this.cancelAllForms();
      this.editingFamily = f;
      this.familyForm = { family_name: f.family_name, notes: f.notes || '' };
      this.showFamilyForm = true;
    },

    cancelFamilyForm() {
      this.showFamilyForm = false;
      this.editingFamily = null;
      this.familyForm = emptyFamilyForm();
    },

    async saveFamily() {
      this.error = '';
      if (!this.familyForm.family_name?.trim()) {
        this.error = 'Family name is required.';
        return;
      }
      try {
        if (this.editingFamily) {
          await window.GTWData.updateFamily(this.editingFamily.id, {
            family_name: this.familyForm.family_name.trim(),
            notes: this.familyForm.notes?.trim() || null
          });
        } else {
          await window.GTWData.createFamily(currentClub.id, {
            family_name: this.familyForm.family_name.trim(),
            notes: this.familyForm.notes?.trim() || null
          });
        }
        this.cancelFamilyForm();
        await this.loadCommon();
      } catch (err) {
        this.error = err.message;
      }
    },

    async deleteFamily(f) {
      if (!confirm(`Delete family "${f.family_name}"? Linked players will keep existing but lose their family link. Cannot be undone.`)) return;
      try {
        await window.GTWData.deleteFamily(f.id);
        await Promise.all([this.loadCommon(), this.loadRoster()]);
      } catch (err) {
        this.error = err.message;
      }
    },

    // ---- contacts ----
    startAddContact(familyId) {
      this.contactForm = emptyContactForm();
      this.showContactForm = familyId;
    },

    cancelContactForm() {
      this.showContactForm = null;
      this.contactForm = emptyContactForm();
    },

    async saveContact() {
      this.error = '';
      if (!this.contactForm.name?.trim()) {
        this.error = 'Contact name is required.';
        return;
      }
      try {
        await window.GTWData.addFamilyContact(this.showContactForm, {
          name: this.contactForm.name.trim(),
          relationship: this.contactForm.relationship || null,
          phone: this.contactForm.phone?.trim() || null,
          email: this.contactForm.email?.trim() || null,
          is_primary: !!this.contactForm.is_primary
        });
        this.cancelContactForm();
        await this.loadCommon();
      } catch (err) {
        this.error = err.message;
      }
    },

    async removeContact(contactId) {
      if (!confirm('Remove this contact?')) return;
      try {
        await window.GTWData.removeFamilyContact(contactId);
        await this.loadCommon();
      } catch (err) {
        this.error = err.message;
      }
    },

    async togglePrimary(contact, family) {
      try {
        // If this contact is being set to primary, un-primary all others first
        if (!contact.is_primary) {
          for (const other of family.family_contacts) {
            if (other.id !== contact.id && other.is_primary) {
              await window.GTWData.updateFamilyContact(other.id, { is_primary: false });
            }
          }
        }
        await window.GTWData.updateFamilyContact(contact.id, { is_primary: !contact.is_primary });
        await this.loadCommon();
      } catch (err) {
        this.error = err.message;
      }
    }
  };
}

function emptyNewPlayerForm() {
  return {
    full_name: '', dob: '', family_id: '', photo_url: '',
    jersey_no: '', positions: [], is_active: true
  };
}

function emptyExistingPlayerForm() {
  return { player_id: '', jersey_no: '', positions: [], is_active: true };
}

function emptyEditForm() {
  return {
    full_name: '', dob: '', family_id: '', photo_url: '',
    jersey_no: '', positions: [], is_active: true
  };
}

function emptyFamilyForm() { return { family_name: '', notes: '' }; }
function emptyContactForm() { return { name: '', relationship: '', phone: '', email: '', is_primary: false }; }

window.rosterView = rosterView;
