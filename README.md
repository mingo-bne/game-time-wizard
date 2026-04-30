# Game Time Wizard

Club basketball management tool — roster, ratings, rotation planning, bench duty, and weekly comms.

## Project layout

```
Game Time Wizard/
├── SCOPE.md              Approved v1 scope
├── README.md             This file
├── index.html            Frontend entry (single-page app)
├── config.js.example     Template for Supabase config — copy to config.js
├── .gitignore
├── css/
│   └── app.css           Custom styles on top of Tailwind
├── js/
│   └── app.js            App logic (auth, routing, views)
└── db/
    ├── schema.sql        Postgres tables, views, triggers
    ├── rls.sql           Row-Level Security policies
    └── seed.sql          Default comm templates
```

## Stack

- **Backend:** Supabase (Postgres + Auth + RLS, free tier)
- **Frontend:** Vanilla HTML + Alpine.js + Tailwind CSS + Supabase JS, all via CDN
- **Build pipeline:** None. Plain static files.
- **Deploy:** GitHub Pages

## One-time setup

### 1. Supabase

1. Create a free project at <https://supabase.com>
2. SQL editor → run `db/schema.sql`
3. SQL editor → run `db/rls.sql`
4. Bootstrap your club + admin staff row (after you've signed in once via the app to create your auth user):
   ```sql
   insert into clubs (name) values ('Your Club Name') returning id;
   -- copy the returned UUID, then run:
   insert into staff (user_id, club_id, full_name, email, is_admin)
   values (auth.uid(), '<club-uuid>', 'Ming Lu', 'mingo.bne@gmail.com', true);
   ```
5. Run `db/seed.sql` with `:club_id` substituted to load default comm templates.
6. **Auth settings** — in Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `https://<your-github-username>.github.io/<repo-name>/`
   - Redirect URLs: add the same URL above

### 2. Frontend config

1. Copy `config.js.example` → `config.js`
2. Fill in your Supabase Project URL and anon/public key (Settings → API in Supabase)
3. The anon key is **safe to publish** — Row-Level Security protects your data

### 3. Run locally (optional)

Any static file server works. Easiest:
```bash
cd "Game Time Wizard"
python3 -m http.server 8000
# then open http://localhost:8000
```

### 4. Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `game-time-wizard`)
2. Push this folder's contents to the repo root
3. **Decide on config.js handling:**
   - **Option A (simple):** Remove `config.js` from `.gitignore`, commit it. The anon key is public-safe.
   - **Option B (cleaner):** Use a GitHub Action to inject `config.js` from repo secrets at deploy time.
4. Repo Settings → Pages → Source: `main` branch, folder `/(root)`
5. Wait for the green checkmark; your app is live at `https://<user>.github.io/<repo>/`
6. **Don't forget to update the Supabase Site URL + Redirect URLs (step 1.6) to match the live URL.**

## Roles

| Role | Permissions |
|---|---|
| Club Admin (`staff.is_admin = true`) | Full access to all teams in the club |
| Head Coach | Edit assigned team(s) including ratings |
| Assistant Coach | Edit assigned team(s) except ratings |
| Team Manager | Edit assigned team(s) except ratings |

All staff can read everything in their own club.

## Build status

See SCOPE.md for module scope. Build sequence tracked in TaskList.

- [x] Schema + RLS + seed
- [x] Frontend scaffold (auth, routing, app shell, stub views)
- [ ] Auth callback + first-run club/team/staff setup
- [ ] Roster module
- [ ] Ratings module (11 sub-skills)
- [ ] Schedule + Game Week shell
- [ ] Bench Duty engine
- [ ] Equal Opportunity Rotation engine
- [ ] Comms templates (3 messages per game)
- [ ] Senior scratch pad
- [ ] End-to-end run-through
