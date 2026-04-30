# Game Time Wizard — v1 Scope (Approved)

**Owner:** Ming Lu
**Approved:** 2026-04-30
**Build approach:** Scaffold-and-iterate (Approach A)

---

## Purpose

Club basketball management tool covering roster, ratings, rotation planning, bench duty, and weekly comms. Built for staff use (head coaches, assistant coaches, team managers). No parent or player accounts in v1.

---

## Architecture

- **Frontend:** Responsive web app (mobile + desktop). Vanilla HTML/JS with Supabase JS client (no build pipeline) — keeps the stack low-maintenance and matches Ming's existing tool philosophy.
- **Backend:** Supabase (Postgres + Auth + Row-Level Security). Free tier handles expected load.
- **Deployment:** Static frontend (Netlify or GitHub Pages); Supabase hosted.
- **Data model:** One club, multiple teams, multiple staff users.
- **Permissions:** Read-all-teams, write-own-team. Head coach owns ratings.

### Roles

| Role | Permissions |
|---|---|
| Head Coach | Full edit on assigned teams, including ratings |
| Assistant Coach | Edit on assigned teams except ratings (read-only) |
| Team Manager | Edit on assigned teams except ratings (read-only) |
| Club Admin (Ming) | Edit all teams |

---

## Modules

### Module 1 — Roster Management
- Per-team rosters
- Player record: name, DOB, jersey #, position(s), photo (optional), parent/guardian name + contact, family link
- Family entity (one or more guardians, one or more contact channels)
- Per-team independent — no cross-team family/sibling logic in v1

### Module 2 — Player Ability Scoring
- Head Coach only edits; others read
- Snapshot model — current rating, updated on demand (no historical tracking in v1)
- **11 sub-skills, each scored 1–5**, grouped into three categories:
  - **Physical** (4): Speed, Strength, Size, Fitness — max 20
  - **Core Skills** (5): Shooting, Ball Handling, Passing, Defence, Rebounding — max 25
  - **Basketball IQ** (2): Court Awareness, Decision Making — max 10
  - **Total possible: 55**
- UI displays both **sum and average** per category
- Team-balance composite derivable for any on-court 5 (used by rotation engine)

### Module 3 — Rotation Engine
- **Per-team rule selection:**
  - **Equal Opportunity** (juniors): engine generates fair rotation
  - **No Engine** (seniors): manual scratch pad with court-time tracker + on-court balance display
- **Equal Opportunity engine:**
  - Per-game fairness window (each player gets ~equal minutes within today's game)
  - Inputs: confirmed availability + ratings + game format (periods × minutes) + roster size
  - Output: period-by-period rotation chart, printable + shareable
- **Game format default: 2 halves × 20 min (40 min total).** Each team can override at team level (e.g. juniors typically 4 periods × 8 or 10 min). Per-game override also available for non-standard fixtures.
- **Hybrid live override** = v2 (data model designed to support it)

### Module 4 — Bench Duty Roster
- Per-team duty pool of families
- Equal-turn allocation across season
- Mark families excluded with reason (one-off date, partial season, full season)
- Skip-then-catch-up logic when a family is unavailable for a specific game
- Generated once schedule is loaded; regeneratable on demand

### Module 5 — Communications
- **Three templated copy/paste-ready text blocks per game:**
  1. **Day -7 to -3:** Weekly availability request
  2. **Day -2:** Logistics + bench duty reminder (date, time, court, opposition, duty roster)
  3. **Day -1:** Game day notice with rotation chart
- Templates editable per club
- No WhatsApp API integration in v1 — coach copy/paste into group

---

## Per-Game Workflow ("Game Week" screen)

The tool's spine. Walks the staff through each game's lifecycle:

| Day | Action | Who | Output |
|---|---|---|---|
| -7 to -3 | Send availability request | Team Manager | Copy/paste text → group |
| -2 | Confirm duty roster, send logistics reminder | Team Manager | Copy/paste text → group |
| -1 (eve) | Confirm availability, generate rotation, send game day notice | Head Coach | Rotation chart + copy/paste text → group |
| 0 | Game played | — | — |
| Post-game | Update attendance + per-player notes | Head Coach | Updated record |

Each step is a button. Each button generates content + marks the step done.

---

## Per-Game Data Captured

- **Availability** (parent-confirmed pre-game): available / unavailable / injured
- **Attendance** (post-game actual): present / no-show / late
- **Court time per player** — auto-calculated from rotation plan
- **Coach notes / observations** per player
- *Not captured in v1:* score, fouls

---

## Deferred to v2

- Senior play-for-win rotation engine (smarter than equal-opportunity)
- Live in-game rotation override
- Across-season fairness balancing (rolling court-time fairness)
- Parent / player accounts
- WhatsApp Business API auto-send
- PlayHQ / Basketball Connect live integration (manual + CSV import only in v1)
- Cross-team / sibling-aware bench duty
- **Training plan generator** — uses team's aggregate rating profile + roster composition to suggest training focus areas

---

## Open items resolved at build time

- Basketball Connect (Basketball Queensland) export options — investigate; if clean ICS/CSV exists, wire it up. Else manual entry.
- Final UI patterns for printable rotation chart
- Branding and visual identity

---

## Build sequence

1. Supabase schema + RLS policies
2. Auth + team/staff setup
3. Roster Management module
4. Player Ratings module
5. Schedule + Game entity + Game Week screen shell
6. Bench Duty engine
7. Equal Opportunity Rotation engine
8. Comms templates (three messages)
9. Senior team scratch pad
10. Polish, printable rotation chart, end-to-end run-through with one team

Each step is a discrete session deliverable.
