# Game Time Wizard

Club basketball management — roster, ratings, rotation planning, bench duty, weekly comms.

**Stack:** Supabase (Postgres + Auth + RLS) backend; vanilla HTML + Alpine.js + Tailwind frontend; GitHub Pages static hosting; no build step.

---

## 📚 Start here

If you're new to this project (developer or PM stepping in), read in this order:

1. **[HANDOVER.md](HANDOVER.md)** — onboarding doc, file map, build status, gotchas
2. **[DECISIONS.md](DECISIONS.md)** — architecture decision record, every key choice and why
3. **[SCOPE.md](SCOPE.md)** — current product scope, modules, what's deferred
4. **[TESTING.md](TESTING.md)** — step-by-step deploy + verify guide for each build milestone
5. **README.md** (this file) — quick reference + setup commands

---

## Project layout

```
Game Time Wizard/
├── HANDOVER.md              ← Read first if new to project
├── DECISIONS.md             ← Architecture decision record
├── SCOPE.md                 ← Current product scope
├── TESTING.md               ← Per-step verification guide
├── README.md                ← This file
├── index.html               ← Single-page app shell + view templates
├── config.js.example        ← Template for Supabase URL + anon key
├── .gitignore
├── css/
│   └── app.css              ← Custom styles (Tailwind handles 99%)
├── js/
│   ├── app.js               ← Root Alpine component (auth, routing)
│   ├── lib/
│   │   ├── data.js          ← All Supabase queries
│   │   └── rotation.js      ← Equal Opportunity rotation algorithm (pure)
│   └── views/
│       ├── dashboard.js     ← Club summary + upcoming games
│       ├── settings.js      ← Club + Staff management
│       ├── teams.js         ← Teams list + create
│       ├── team-detail.js   ← Team settings + staff assignments
│       ├── roster.js        ← Players + Families (per team)
│       ├── ratings.js       ← Per-team player ratings (11 sub-skills)
│       ├── games.js         ← Games list + create/edit per team
│       └── game-week.js     ← Per-game workflow shell
├── db/
│   ├── schema.sql           ← Canonical Postgres schema (fresh deploy)
│   ├── rls.sql              ← Row-Level Security policies
│   ├── seed.sql             ← Default comm templates
│   ├── migration_step3.sql  ← Pending-staff + auto-attach trigger
│   ├── migration_step4_5.sql ← Restructure: club-level players + memberships
│   ├── migration_step4_6.sql ← Cross-tool foundation: seasons, opponents, plays, prefs
│   ├── migration_step6_5.sql ← Division on teams + age_group/division on opponents
│   ├── migration_step6_6.sql ← Gender on teams
│   ├── migration_step7_5.sql ← Bench duty: family-based → player-based
│   ├── migration_step8_5.sql ← Per-team sub block size + borrowed players
│   ├── migration_step8_7.sql ← Team color (tile-based UI + visual identity)
│   └── migration_step8_8.sql ← Simplify positions to G/F/C (was PG/SG/SF/PF/C)
└── Prototype tools/
    ├── project_citipointe_basketball.md  ← Sister tool spec
    └── COURTSIDE_PROJECT_BRIEF.md        ← Sister tool spec (already-built PWA)
```

---

## Roles + permissions

| Role | Permissions |
|---|---|
| Club Admin (`staff.is_admin = true`) | Full access to all teams in the club |
| Head Coach | Edit assigned team(s) including ratings |
| Assistant Coach | Edit assigned team(s) except ratings |
| Team Manager | Edit assigned team(s) except ratings |

All staff can read everything in their own club.

---

## Build status

- [x] Schema + RLS + seed
- [x] Frontend scaffold (auth, routing, app shell, stub views)
- [x] Settings (Club + Staff), Teams, Team Detail with staff assignments
- [x] Roster module (Players + Families + Contacts)
- [x] Restructure: club-level players + per-team memberships, team-specific ratings
- [x] Cross-tool data foundation (seasons, opponents, plays, player_preferences, game scores)
- [x] Ratings module (11 sub-skills, per team)
- [x] Schedule + Game Week shell (games CRUD + per-game workflow placeholders + post-game data entry)
- [x] Bench Duty engine (pool, exclusions, fairness algorithm, Day-2 card on Game Week)
- [x] Equal Opportunity Rotation engine (availability + algorithm + chart + print)
- [x] Manual rotation editing — clickable cells, two-click swap, also covers senior teams ("Start empty plan" → build manually)
- [ ] **Next: Comms templates** (3 messages per game)
- [ ] Equal Opportunity Rotation engine
- [ ] Comms templates (3 messages per game)
- [ ] Senior scratch pad
- [ ] End-to-end run-through

See `HANDOVER.md` for the full status table.

---

## One-time setup (fresh Supabase project)

1. Create a free Supabase project at <https://supabase.com>
2. SQL editor → run `db/schema.sql` (one shot — includes all tables, views, triggers in current canonical form)
3. SQL editor → run `db/rls.sql`
4. Sign in to the deployed app via magic link (this creates your `auth.users` row)
5. Bootstrap your admin record:
   ```sql
   insert into clubs (name) values ('Your Club Name') returning id;
   -- copy the returned UUID, then:
   insert into staff (user_id, club_id, full_name, email, is_admin)
   values (
     (select id from auth.users where email = 'you@example.com'),
     '<club-uuid>',
     'Your Name',
     'you@example.com',
     true
   );
   ```
6. Run `db/seed.sql` with `:club_id` substituted to load default comm templates
7. **Auth settings** — Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `https://<your-github-username>.github.io/<repo-name>/`
   - Redirect URLs: add the same URL above

The migration files (`migration_step*.sql`) are for upgrading an existing database that was set up before later changes were made. A fresh deploy only needs `schema.sql` + `rls.sql` + `seed.sql`.

---

## Frontend config

1. Copy `config.js.example` → `config.js`
2. Fill in your Supabase Project URL and anon/public key (Settings → API in Supabase)
3. The anon key is **safe to publish** — Row-Level Security protects your data

---

## Run locally

```bash
cd "Game Time Wizard"
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push folder contents to a public GitHub repo
2. Repo Settings → Pages → Source: `main` branch, root folder
3. Update Supabase Site URL + Redirect URLs to match the GH Pages URL

---

## Sister tools (planned integrations)

This project is part of a three-tool ecosystem for the basketball club:

| Tool | Status | Purpose |
|---|---|---|
| **Game Time Wizard** (this) | In build | Roster, ratings, rotations, duty, comms |
| **CourtSide Stats** | Built (deployed) | Live in-game stat entry PWA. Will sync to this app's `plays` table once the bridge is built. |
| **Citipointe Team Mgmt** | Spec only | Pre-season intake, age-group assignment, team formation drag-and-drop. |

The data foundation (step 4.6) was specifically designed to support these integrations without future schema rework. See `DECISIONS.md` ADR-012 and ADR-013, plus `Prototype tools/` for the sister tool briefings.

---

## Owner

Ming Lu — `mingo.bne@gmail.com`. Brisbane.
