# Architecture Decision Record — Game Time Wizard

Captures the key architectural decisions made between 2026-04-30 and 2026-05-01, with the rationale behind each one. Read this before changing the design — most decisions reverse cheaply if you have the context, expensively if you don't.

---

## ADR-001 — Stack: Supabase + vanilla HTML/JS/Alpine + GitHub Pages

**Decision:** Supabase (Postgres + Auth + RLS) backend; vanilla HTML + Alpine.js + Tailwind CDN frontend; GitHub Pages static hosting; no build pipeline.

**Why:**
- Multi-staff requirement (head coach + assistants + team managers all need access) ruled out single-file HTML + localStorage.
- Supabase free tier handles expected load comfortably (one club, ~5 staff, hundreds of games over a season).
- No build pipeline keeps the project trivially modifiable — open `.html` and `.js` in any editor, push, done.
- Alpine.js gives declarative reactivity without React's tooling overhead.
- GitHub Pages is free, integrates with the no-build pipeline, and supports custom domain later.

**Trade-offs accepted:**
- No code splitting — the whole frontend ships as one HTML + a handful of JS files. Acceptable at this app size.
- Supabase anon key is published in `config.js` — that's by design (RLS does the gatekeeping; the anon key is meant to be public).
- No TypeScript — easier to onboard, less compile-time safety.

**Reversal cost:** Medium. Changing to a build pipeline (Vite/SvelteKit/Next) is feasible — the Alpine components map roughly 1:1 to small framework components.

---

## ADR-002 — Multi-team scope, club-wide staff sharing

**Decision:** One club, multiple teams, multiple staff. Staff are scoped to a club; assigned to specific teams via `team_staff` table.

**Why:**
- Original ask was "club basketball management". A single coach managing one team is a degenerate case.
- Staff sharing across teams (one assistant coach on two teams) is common in real clubs.

**Reversal cost:** Low. Single-team usage is just a special case (one team, no team_staff complexity).

---

## ADR-003 — Permission model: read-all-write-own with admin override

**Decision:**
- Any staff in the club can read all club data (across all teams).
- Edit rights are scoped to teams the staff member is assigned to.
- Ratings can only be edited by the Head Coach of that team.
- Club Admin (`staff.is_admin = true`) overrides everything within the club.

**Why:**
- Read-all encourages cross-team awareness (assistant on Team A might want to see Team B's roster for a friendly match).
- Write-own prevents accidental cross-team damage.
- Head-coach-only ratings preserves the single-source-of-truth for player assessment.
- Admin override needed for setup, fixing things, removing departed staff.

**How enforced:** Postgres Row-Level Security (`db/rls.sql`). Helper SQL functions (`is_team_staff`, `is_head_coach`, `is_club_admin`, `in_club`) keep policies readable.

**Reversal cost:** Low — RLS policies are isolated to `rls.sql`.

---

## ADR-004 — Pending-staff with auth trigger auto-attach

**Decision:** Staff records can be created with `user_id = NULL` ("pending"). When a new auth user signs up via magic link, a Postgres trigger (`auto_attach_staff_on_signup`) matches their email to any pending staff record and links the `user_id` automatically.

**Why:**
- Admin needs to invite staff *before* they sign up.
- Without a backend, we can't use Supabase's admin invite API from the frontend.
- The trigger pattern lets the admin pre-create the access record + team assignments. The new user just clicks the invite URL, signs in via magic link, and is immediately granted access.

**Reversal cost:** Medium. If you want to switch to the admin invite API, you need to add a server-side function (Supabase edge function) and update the staff creation flow.

---

## ADR-005 — Per-team rule modes: Equal Opportunity vs No Engine

**Decision:** Each team has a `rule_mode` field with two values:
- `equal_opportunity` — rotation engine generates a fair plan (junior basketball, equal court time)
- `no_engine` — manual scratch pad only (senior basketball, "play to win", coach intuition)

**Why:**
- Junior and senior basketball have fundamentally different sub rules.
- Senior "play-to-win" rotation is a hard problem (fatigue, fouls, matchups) — building it as automation risks producing bad recommendations and losing the coach's trust.
- A scratch pad (court-time tracker + on-court balance display) gives senior coaches visibility without forcing decisions.

**Reversal cost:** Low — adding a third mode is just a CHECK constraint update + new engine.

---

## ADR-006 — Game format: 2 × 20 default, configurable per team and per game

**Decision:**
- Schema uses neutral term "periods" (not "halves" or "quarters").
- Team default: `game_format_periods = 2`, `game_format_minutes_per_period = 20` (40 min total).
- Each game can override the team default for non-standard fixtures.

**Why:**
- Senior basketball: 2 halves × 20 min.
- Junior basketball (Brisbane): 4 quarters × 8 or 10 min.
- One schema field name has to win — "periods" is league-neutral.

**Reversal cost:** Low — pure naming.

---

## ADR-007 — Three-message comms workflow, copy/paste only (no API)

**Decision:** Comms module generates copy/paste-ready text for three weekly messages:
1. Day -7 to -3: Availability request
2. Day -2: Logistics + bench duty reminder
3. Day -1: Game day notice with rotation

No WhatsApp Business API integration in v1.

**Why:**
- WhatsApp Business API requires Meta business verification, approved templates, per-message cost. Weeks of friction for a 5-staff club.
- Copy/paste covers 90% of the value at 0% of the friction. Coach taps "Generate", text is pre-filled, paste into the team chat, send.
- Easy to upgrade to API later if a club grows large enough to justify it.

**Reversal cost:** Medium. Templates are ready; adding API send is a frontend integration (Twilio, Meta Cloud API).

---

## ADR-008 — Per-game fairness window (not season-rolling)

**Decision:** Equal-opportunity rotation engine balances court time *within a single game*, not across the season.

**Why:** Original scope decision (Ming, 2026-04-30). Per-game is what most junior clubs do; across-season is more sophisticated but harder to explain mid-game ("why is my kid sitting? Because last week they played extra...").

**Reversal cost:** Medium. The data is there to track season totals; the engine just needs an option for season-balanced mode.

---

## ADR-009 — Player ratings: 11 sub-skills, head coach only, snapshot model

**Decision:**
- 11 sub-skills grouped into 3 categories, each scored 1–5:
  - **Physical** (4): Speed, Strength, Size, Fitness — max 20
  - **Core Skills** (5): Shooting, Ball Handling, Passing, Defence, Rebounding — max 25
  - **Basketball IQ** (2): Court Awareness, Decision Making — max 10
  - Total possible: 55
- Display: BOTH sum and average per category
- Snapshot only — no historical tracking, head coach updates on demand

**Why:**
- Sub-skill granularity supports player development conversations (richer than a single composite).
- Snapshot model keeps maintenance low (no per-game rating workflow).
- Head-coach-only authorship prevents rating drift / conflicting opinions.

**Reversal cost:** Low. Adding history is a new `ratings_history` table mirroring `ratings`.

---

## ADR-010 — CLUB-LEVEL players + per-team memberships (key restructure)

**Decision (made 2026-04-30):** Players and Families are club-level entities. A new `team_memberships` table holds per-team facts (jersey, positions, active flag, joined/left dates). Same human can be on multiple teams with different jersey numbers and positions.

**Why:**
- Original v1 scope put rosters as per-team-independent (no cross-team logic).
- Ming flagged that the same kid playing two teams (rep + local, or playing up an age group) would mean duplicate player + family records, and contact info would drift.
- Future integration with CourtSide Stats and the Citipointe Team Mgmt tool both want one source of truth per human.
- Reversed the original decision because the cross-tool integration story was worth the rework.

**Reversal cost:** High (you'd lose multi-tool integration). Don't reverse without strong reason.

---

## ADR-011 — Ratings keyed on (player_id, team_id) — team-context-specific

**Decision:** Ratings table has `unique (player_id, team_id)` — same human can carry different ratings in different teams.

**Why:**
- A 14-year-old playing U14 might be 5/5 Speed; the same kid playing senior reserves might be 3/5 Speed (relative-to-context).
- Coach assessment is contextual to where the player is being assessed.

**Reversal cost:** Low. Drop to single rating per player by removing team_id and merging.

---

## ADR-012 — Cross-tool data foundation (seasons, opponents, plays, prefs)

**Decision (made 2026-05-01):** Schema additions to support integration with two future tools:
- **Citipointe Team Management Tool** — needs seasons, demographics, intake preferences
- **CourtSide Stats** — needs plays + game scores

Tier 1 (added now):
- `seasons` table — first-class entity (replaces `teams.season` text)
- `opponents` table — first-class entity (replaces `games.opposition` text); supports logos, primary colors, head-to-head history
- `players` demographic fields: gender, first_year_of_play, primary_school, phone, email, external_ids (jsonb), is_active_in_club

Tier 2 (added now):
- `player_preferences` table (per-player-per-season): intention to play, registration status, preferred days, wants-to-play-with, preferred coach
- `plays` table: per-stat per-game event log (game_id, player_id, period, stat_type, made, assist_player_id)
- `player_game_stats` view: derived per-player-per-game shooting splits + counts + points
- `games`: team_score, opposition_score, result columns

**Why:**
- Cheaper to add the foundation now than retrofit when integration starts.
- All additions are backward-compatible — existing UI continues to work; new fields surface in later UI steps.

**Reversal cost:** Tier 1 = medium (data migration if dropped); Tier 2 = low (new tables, no other code depends on them yet).

---

## ADR-013 — CourtSide integration via shared plays table (Option B)

**Decision:** CourtSide Stats (Ming's existing PWA at `https://mingo-bne.github.io`) stays offline-first localStorage but on game setup pulls roster from Game Time Wizard's Supabase, and on end-of-game pushes plays to the new `plays` table.

**Why:**
- Preserves CourtSide's offline-first sideline UX (essential for stadium WiFi reality).
- Single source of truth for player identity (`players.id` UUID).
- No name-matching fragility.
- Game Time Wizard becomes the canonical store; CourtSide is the live entry app.

**Reversal cost:** Medium. Other paths considered:
- Option A (CSV import): chosen against — name matching breaks with similar names.
- Option C (full unified app): chosen against — would break CourtSide's offline-first guarantee.

**What's NOT done yet:** the actual CourtSide ↔ Supabase integration code. Schema is ready; CourtSide-side changes happen after Game Time Wizard v1 ships.

---

## ADR-014 — Game Week screen as the spine

**Decision:** Per-game workflow is driven by a single screen showing each upcoming game with sequential steps:
- Day -7 to -3: Send availability request (copy/paste)
- Day -2: Send logistics + duty roster reminder (copy/paste)
- Day -1 evening: Confirm availability + generate rotation + send game day notice
- Day 0: Game played
- Post-game: Update attendance + coach notes

A Postgres view (`game_week_status`) computes which steps are done per game.

**Why:**
- A coach Sunday-night-prepping for the next game shouldn't have to think about which step is next — the screen tells them.

**Reversal cost:** Low — the view can change without affecting underlying data.

---

## Things explicitly DEFERRED

- **Senior play-to-win rotation engine** — too risky to ship as automation. Manual scratch pad instead.
- **Live in-game rotation override** — pre-game plan only in v1.
- **Across-season fairness balancing** — per-game window only.
- **Parent / player accounts** — staff-only in v1.
- **WhatsApp Business API auto-send** — copy/paste only.
- **PlayHQ / Basketball Connect live sync** — manual game entry; investigate ICS/CSV export later.
- **Cross-team / sibling-aware bench duty** — per-team independent.
- **Training plan generator** — V2.
