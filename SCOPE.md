# Game Time Wizard — Scope (current)

**Owner:** Ming Lu
**Originally approved:** 2026-04-30
**Last updated:** 2026-05-01
**Build approach:** Scaffold-and-iterate

For the rationale behind every architectural decision in this scope, see `DECISIONS.md`. For the current build status and onboarding instructions, see `HANDOVER.md`.

---

## Purpose

Club basketball management tool covering roster, ratings, rotation planning, bench duty, and weekly comms. Built for staff use (head coaches, assistant coaches, team managers). No parent or player accounts in v1.

Data foundation also supports integration with two sister tools (CourtSide Stats — already built; Citipointe Team Management Tool — planned) without future schema rework.

---

## Architecture

- **Frontend:** Vanilla HTML + Alpine.js + Tailwind CDN + Supabase JS — all CDN, no build step. Mobile-responsive.
- **Backend:** Supabase (Postgres + Auth + Row-Level Security). Free tier comfortably handles expected load.
- **Deployment:** Static frontend on GitHub Pages; Supabase hosted.
- **Auth:** Magic link (passwordless email).
- **Permissions:** read-all-write-own with admin override (see DECISIONS ADR-003).

### Roles

| Role | Permissions |
|---|---|
| Club Admin (`staff.is_admin = true`) | Full access to all teams in the club |
| Head Coach | Edit assigned team(s) including ratings |
| Assistant Coach | Edit assigned team(s) except ratings |
| Team Manager | Edit assigned team(s) except ratings |

All staff can read everything in their own club.

---

## Modules

### Module 1 — Roster Management ✅ (built)
- **Players are CLUB-LEVEL** (not per-team). One human, one record (DOB, gender, school, contact, photo, family link, external IDs).
- **Families are CLUB-LEVEL.** One source of truth for parent/guardian contacts; primary-contact toggle is single-primary per family.
- **Per-team facts** (jersey, positions, active flag) live on `team_memberships` — one row per (player, team) pair.
- Same player can be on multiple teams with different jersey numbers / positions.

### Module 2 — Player Ability Scoring ⏳ (next)
- Head Coach only edits; assistants/managers read.
- Snapshot model (no historical tracking in v1).
- **Ratings keyed on (player, team)** — same player can carry different ratings in different teams (a 14yo's "Speed" in U14 context vs Senior context can differ).
- 11 sub-skills, each scored 1–5, grouped into 3 categories:
  - **Physical** (4): Speed, Strength, Size, Fitness — max 20
  - **Core Skills** (5): Shooting, Ball Handling, Passing, Defence, Rebounding — max 25
  - **Basketball IQ** (2): Court Awareness, Decision Making — max 10
  - Total possible: 55
- UI displays both **sum and average** per category.

### Module 3 — Rotation Engine (designed, not built)
- **Per-team rule mode** (configured at team creation):
  - **Equal Opportunity** (juniors): engine generates fair rotation
  - **No Engine** (seniors): manual scratch pad with court-time tracker + on-court balance display
- **Equal Opportunity engine:**
  - Per-game fairness window (each available player gets ~equal minutes within today's game).
  - Inputs: confirmed availability + ratings + game format + roster size.
  - Output: period-by-period rotation chart, printable + shareable.
- **Game format default: 2 periods × 20 min (40 total).** Per-team override supported (juniors typically 4 × 8 or 10 min). Per-game override also supported for non-standard fixtures.

### Module 4 — Bench Duty Roster (designed, not built)
- Per-team duty pool of families.
- Equal-turn allocation across the season.
- Mark families excluded with reason (one-off date, partial, full season).
- Skip-then-catch-up logic when an assigned family is unavailable.
- Generated once schedule loaded; regeneratable on demand.

### Module 5 — Communications (designed, not built — templates seeded)
- Three templated copy/paste-ready text blocks per game:
  1. **Day -7 to -3:** Weekly availability request
  2. **Day -2:** Logistics + bench duty reminder (date, time, court, opposition, duty roster)
  3. **Day -1:** Game day notice with rotation chart
- Templates editable per club (default templates seeded via `db/seed.sql`).
- No WhatsApp API integration — coach copy/paste into group chat.

---

## Per-Game Workflow ("Game Week" screen — designed, not built)

The tool's spine. Walks staff through each game's lifecycle:

| Day | Action | Who | Output |
|---|---|---|---|
| -7 to -3 | Send availability request | Team Manager | Copy/paste text → group |
| -2 | Confirm duty roster, send logistics reminder | Team Manager | Copy/paste text → group |
| -1 (eve) | Confirm availability, generate rotation, send game day notice | Head Coach | Rotation chart + copy/paste text → group |
| 0 | Game played | — | — |
| Post-game | Update attendance + per-player notes (and optionally score, result) | Head Coach | Updated record |

Each step is a button. Each button generates content + marks the step done.

`game_week_status` SQL view computes which steps are done for each upcoming game.

---

## Per-Game Data Captured

- **Availability** (parent-confirmed pre-game): available / unavailable / injured / tentative
- **Attendance** (post-game actual): present / late / no_show / excused
- **Court time per player** — auto-calculated from rotation plan
- **Coach notes / observations** per player
- **Score + result** (post-game) — `team_score`, `opposition_score`, `result` columns on games
- **Per-stat play log** — `plays` table (CourtSide writes here once integration ships)

---

## Cross-tool data foundation

Schema includes the entities required to support two sister tools without rework:

### For Citipointe Team Management Tool
- `seasons` (first-class entity, replaces text season field)
- `players.gender`, `first_year_of_play`, `primary_school`, `phone`, `email`, `external_ids` (jsonb)
- `players.is_active_in_club`
- `player_preferences` (per-player-per-season): intention to play, registration status, preferred days, "wants to play with" array, preferred coach, source

### For CourtSide Stats integration
- `plays` table (per-stat per-game event log, links via `players.id`)
- `player_game_stats` view (derived per-player-per-game shooting splits + counts + points)
- `games.team_score`, `games.opposition_score`, `games.result`
- `opponents` table (proper entity with logos, primary colors, head-to-head history)

See `Prototype tools/COURTSIDE_PROJECT_BRIEF.md` and `Prototype tools/project_citipointe_basketball.md` for the sister tool specs.

---

## Deferred to v2

- Senior play-for-win rotation engine (smarter than equal-opportunity)
- Live in-game rotation override
- Across-season fairness balancing (rolling court-time fairness)
- Parent / player accounts
- WhatsApp Business API auto-send
- PlayHQ / Basketball Connect live integration (manual + CSV import only in v1)
- Cross-team / sibling-aware bench duty (per-team independent in v1)
- **Training plan generator** (uses team's aggregate rating profile + roster composition to suggest training focus areas)
- **Settings → Seasons UI** (schema in place; UI lands when needed)
- **Settings → Opponents UI** (schema in place; UI lands when Games module is built)
- **Roster demographic fields in UI** (schema in place; form needs extension)
- **CourtSide bridge frontend** (schema ready; CourtSide PWA needs sync code)

---

## Build sequence

1. Supabase schema + RLS ✅
2. Frontend scaffold + auth + routing ✅
3. Settings + Teams + Team Detail (with staff assignments) ✅
4. Roster Management module ✅
   - 4.5: Restructure to club-level players + per-team memberships ✅
   - 4.6: Cross-tool data foundation (seasons, opponents, plays, prefs) ✅
5. Player Ratings module ⏳
6. Schedule + Game entity + Game Week screen shell
7. Bench Duty engine
8. Equal Opportunity Rotation engine
9. Comms templates (3 messages per game)
10. Senior team scratch pad
11. End-to-end run-through with one real team

Each step is a discrete session deliverable. See `TESTING.md` for verification paths.
