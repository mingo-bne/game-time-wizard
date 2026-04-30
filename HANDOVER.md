# Handover — Game Time Wizard

If you're stepping into this project as a developer or project manager, start here. This document is the single index — read it end-to-end, then jump to the linked docs as needed.

---

## What this is

Game Time Wizard is a club basketball management web app. It replaces manual rotation planning, bench duty rosters, and weekly comms with a single tool used by club staff (head coaches, assistant coaches, team managers).

**Owner:** Ming Lu (CPA, Brisbane). Originally built for his own use coaching a junior basketball club, designed to scale to multi-team clubs.

**Live:** TBD (Ming deploys to GitHub Pages — URL is in his `config.js`).

**Built on:** Supabase (database + auth), vanilla HTML/Alpine.js/Tailwind frontend, GitHub Pages static hosting. No build pipeline. No backend code.

---

## Where to find things

| Doc | What's in it |
|---|---|
| `README.md` | Quick setup steps, file map, build status |
| `SCOPE.md` | Approved v1 product scope, modules, deferred items |
| `DECISIONS.md` | **Read this first.** Architecture decision record — every key choice and why |
| `HANDOVER.md` | This file — onboarding for new contributors |
| `TESTING.md` | Step-by-step deploy + test guide for each build step |
| `db/schema.sql` | Canonical Postgres schema (run on a fresh Supabase project) |
| `db/rls.sql` | Row-Level Security policies (run after schema) |
| `db/seed.sql` | Default comm message templates (run after RLS) |
| `db/migration_step3.sql` | Pending-staff support + auto-attach trigger |
| `db/migration_step4_5.sql` | Restructure to club-level players + memberships |
| `db/migration_step4_6.sql` | Cross-tool foundation: seasons, opponents, plays, etc. |
| `index.html` | Single-page app shell + all view templates |
| `js/app.js` | Root Alpine component (auth, routing, navigation) |
| `js/lib/data.js` | All Supabase queries — every table CRUD lives here |
| `js/views/settings.js` | Settings view (Club + Staff tabs) |
| `js/views/teams.js` | Teams list + create form |
| `js/views/team-detail.js` | Team settings + staff assignments |
| `js/views/roster.js` | Players + Families view (per team) |
| `css/app.css` | Custom styles (Tailwind handles 99% of it) |
| `config.js.example` | Template for Supabase URL + anon key |
| `Prototype tools/` | Briefing docs for sister tools (CourtSide Stats, Citipointe Team Mgmt) |

---

## Stack summary

```
Browser                                  Supabase (Postgres)
┌──────────────────────────────┐        ┌────────────────────────────┐
│  index.html  (Alpine + Tailwind via CDN) │        │  Tables: clubs, teams, staff,    │
│  js/app.js   (auth + router) │  ───►  │  team_staff, players, families,  │
│  js/views/*  (per-screen)    │  REST  │  family_contacts, team_memberships, │
│  js/lib/data.js  (Supabase JS client) │  ◄───  │  ratings, games, availabilities, │
└──────────────────────────────┘        │  attendances, coach_notes,       │
                                         │  duty_pool_exclusions, duty_assignments, │
GitHub Pages                             │  rotation_plans, comm_templates,  │
(static file hosting)                    │  comm_messages, seasons, opponents,│
                                         │  player_preferences, plays         │
                                         │                                    │
                                         │  Views: game_week_status,         │
                                         │  player_balance_score,            │
                                         │  player_game_stats                │
                                         │                                    │
                                         │  Auth: Supabase Auth (magic link) │
                                         │  RLS: Row-Level Security on all   │
                                         └────────────────────────────────────┘
```

**No build step.** No `npm install`. No bundler. Open `index.html` in a browser; it loads everything from CDNs.

---

## Build status (as of 2026-05-01)

| # | Step | Status |
|---|---|---|
| 1 | Supabase schema + RLS | ✅ Done |
| 2 | Frontend scaffold (auth, routing, app shell) | ✅ Done |
| 3 | Settings + Teams + Team detail | ✅ Done |
| 4 | Roster (players + families) | ✅ Done |
| 4.5 | Restructure to club-level players + memberships | ✅ Done |
| 4.6 | Cross-tool foundation (seasons, opponents, plays, prefs) | ✅ Done — UI surfaces in later steps |
| 5 | Player Ratings module (11 sub-skills, per team) | ✅ Done |
| 6 | Schedule + Game entity + Game Week screen shell | ✅ Done |
| 6.5 | Division on teams + age_group/division on opponents (filters opposition picker) | ✅ Done |
| 6.6 | Gender on teams + functional dashboard (counts, upcoming games, quick links) | ✅ Done |
| 7 | Bench Duty engine | ✅ Done |
| 7.5 | Refactor: Bench Duty family-based → player-based (sibling toggle, availability-aware) | ✅ Done |
| 8 | Equal Opportunity Rotation engine (per-game availability + period-by-period chart + print) | ✅ Done |
| 8.5 | Per-team sub block size + borrowed players (priority weight reduces share) | ✅ Done |
| 8.6 | Manual rotation editing — also covers senior "scratch pad" use case (ADR-020) | ✅ Done |
| 8.7 | Tile-based Teams view + per-team color (used for tiles, headers, dashboard chips) | ✅ Done |
| 8.8 | Simplify positions to G/F/C (was PG/SG/SF/PF/C) — junior coach speak | ✅ Done |
| 9 | Comms templates (3 copy/paste messages per game + Settings → Comms templates editor) | ✅ Done |
| 11 | End-to-end run-through with one real team | ⏳ Last |
| 10 | ~~Senior scratch pad~~ — superseded by step 8.6, deleted from build sequence | — |
| 9 | Comms templates (3 messages per game) | Pending |
| 10 | Senior team scratch pad | Pending |
| 11 | End-to-end run-through with one real team | Pending |

---

## How to run locally

```bash
cd "Game Time Wizard"
python3 -m http.server 8000
# open http://localhost:8000
```

You'll see the "Setup needed" screen until `config.js` exists.

To get past that:
1. Copy `config.js.example` to `config.js`
2. Fill in your Supabase Project URL + anon key (Settings → API in Supabase dashboard)

For a clean local test environment, create a separate Supabase project so you don't pollute production data.

---

## How to deploy

GitHub Pages static hosting:

1. Push the `Game Time Wizard/` folder contents to a public GitHub repo
2. Repo Settings → Pages → Source: `main` branch, root folder
3. Set Supabase Auth → URL Configuration: Site URL + Redirect URLs to your `https://<user>.github.io/<repo>/` URL
4. Visit the URL, magic-link in
5. First user must run a small bootstrap SQL in Supabase to give themselves admin status (see `TESTING.md` step 6)

After that, all subsequent staff are invited via the in-app Settings → Staff → "Invite staff" form (creates a pending staff record; they sign in and the Postgres trigger auto-attaches them).

---

## How to test

`TESTING.md` has step-by-step verification paths for each build milestone. Re-run the relevant section after any meaningful code change.

For the most recent build (step 4.6), see `TESTING.md` → "Step 4.6 — Testing the cross-tool data foundation".

---

## How to add a new view (recipe)

1. **Decide where it sits in nav.** Edit `nav` array in `js/app.js`.
2. **Create the data layer.** Add `listX`, `createX`, `updateX`, `deleteX` to `js/lib/data.js` inside the IIFE; export them in the return object.
3. **Create the view component.** Make `js/views/yourview.js` defining a function `yourViewView(currentClub, currentStaff)` that returns an Alpine data object. Expose as `window.yourViewView`.
4. **Add the script tag.** In `index.html`, near the other `js/views/*.js` script tags at end of body.
5. **Add the route template.** In `index.html`, inside the main content area, add `<template x-if="route === 'yourview'">` ... `</template>`. Use `x-data="yourViewView(currentClub, currentStaff)" x-init="init()"`.
6. **Permissions.** RLS handles the database side. For UI gating (hide buttons), check `currentStaff?.is_admin` or call a `canEdit()` helper.

---

## How to add a new database table (recipe)

1. **Add to `db/schema.sql`** — the table definition + indexes + triggers (use `set_updated_at()` for `updated_at`).
2. **Add to `db/rls.sql`** — `enable row level security` + read/write policies. Use the helper functions (`in_club`, `is_team_staff`, `is_head_coach`, `is_club_admin`).
3. **Write a migration file** `db/migration_stepN.sql` — Ming runs this on the existing database. Include `if not exists` so it's safely re-runnable.
4. **Add data layer helpers** in `js/lib/data.js`.
5. **Update `TESTING.md`** with a verification path.
6. **Update `README.md`** file inventory.

---

## Common gotchas

- **`auth.uid()` returns NULL in the Supabase SQL Editor.** It runs as admin, not as your user. For SQL bootstrapping, use `(select id from auth.users where email = 'you@example.com')` instead.
- **Trailing slash matters in Supabase auth URL config.** `https://x.github.io/repo/` and `https://x.github.io/repo` are different URLs.
- **`config.js` in `.gitignore` doesn't block GitHub web uploads.** `.gitignore` is a local-git thing; web uploads bypass it. So `config.js` will commit even if listed in `.gitignore`.
- **The Supabase anon key is safe to publish.** RLS does the gatekeeping. Don't panic when you see it in the repo.
- **Alpine `x-data="someFn(arg)"` evaluates `arg` against the parent scope.** That's how child views receive `currentClub`, `currentStaff`, etc.
- **`navigate(route, subroute)` updates the URL hash, which fires `hashchange`, which updates the route.** Don't bypass it.
- **Hidden files (`.gitignore`)** in macOS Finder need `Cmd+Shift+.` to toggle visible.

---

## Open issues / known incomplete

- **Senior team scratch pad:** designed (see `SCOPE.md`) but not built.
- **Game Week screen:** designed but not built.
- **Rotation engine:** designed but not built. Algorithm spec is in `SCOPE.md` Module 3.
- **Bench duty engine:** designed but not built.
- **Comms templates UI:** templates seeded into DB; UI to render messages with token substitution not built.
- **Seasons UI:** schema is in place, "Default Season" auto-created per club; no Settings → Seasons UI yet.
- **Opponents UI:** schema is in place; no Settings → Opponents UI yet (game form will populate this once Games view is built in step 6).
- **Player demographic fields in roster form:** schema has gender/school/external_ids; roster form doesn't expose them yet.
- **CourtSide ↔ Supabase bridge:** `plays` table is ready; the actual sync code in CourtSide PWA hasn't been written.
- **Citipointe Team Mgmt integration:** `player_preferences` table is ready; intake form processing not built.

---

## Other tools in the same ecosystem

Game Time Wizard is one of three related tools Ming uses or plans for the basketball club:

1. **Game Time Wizard** (this app) — roster, ratings, rotations, duty, comms.
2. **CourtSide Stats** — live in-game stat entry PWA. Already built and in use. Lives at `https://mingo-bne.github.io`. Currently localStorage-only; planned migration to write `plays` to this app's Supabase. See `Prototype tools/COURTSIDE_PROJECT_BRIEF.md`.
3. **Citipointe Team Management Tool** — pre-season intake, age-group assignment, drag-and-drop team formation. Planning doc only — not yet built. See `Prototype tools/project_citipointe_basketball.md`.

The data foundation in step 4.6 (`migration_step4_6.sql`) is what makes integrating with these two tools possible without future schema rework.

---

## Original designer's contact

Ming Lu — `mingo.bne@gmail.com`. Brisbane (AEST/AEDT, UTC+10/+11). CPA background; deeply technical in business systems and financial modelling; new to web dev specifics — assume strong design instincts and ERP-level data thinking, but give him exact ready-to-run commands when the conversation is technical (file paths, SQL syntax, deploy steps).

When picking up the project, his communication style preferences:
- Direct, concise, no filler
- Challenge assumptions; offer a point of view
- Flag risks and trade-offs proactively
- Don't over-explain finance/accounting concepts unless asked
- For investor-facing deliverables, English by default; ask about Simplified Chinese version
