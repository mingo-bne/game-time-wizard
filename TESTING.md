# Game Time Wizard — Testing Walkthrough

First-time setup and test guide for the v1 scaffold. Estimated time: 30 minutes.

---

## Step 1 — Quick visual check (1 min)

This confirms the HTML/CSS/JavaScript loads correctly before you touch anything else.

1. Open Finder, navigate to `Documents/Claude/Projects/Ming's Useful Tools/Game Time Wizard/`
2. Double-click `index.html` — it opens in your default browser
3. **You should see:** an orange-bordered card saying "⚙️ Setup needed" with instructions about `config.js`

✅ If you see that, the scaffold loads correctly. Continue to Step 2.
❌ If you see a blank page or an error, take a screenshot and let me know.

---

## Step 2 — Set up Supabase (10 min)

Supabase is the backend (database + login). Free tier is fine.

1. Go to <https://supabase.com> and click **Start your project**
2. Sign up (use GitHub login if you have it — easiest)
3. Once in the dashboard, click **New project**
   - Organization: pick the default
   - Name: `game-time-wizard` (or whatever you like)
   - Database password: generate a strong one and **save it somewhere safe** (you won't need it for this app, but Supabase requires one)
   - Region: pick the one closest to Brisbane (Sydney)
   - Click **Create new project**
4. Wait ~2 minutes for the project to provision (you'll see a progress spinner)

### Run the database setup

5. In the left sidebar of your Supabase project, click the **SQL Editor** icon (looks like `>_`)
6. Click **+ New query**
7. Open `db/schema.sql` from your project folder in any text editor (TextEdit works), copy the entire contents
8. Paste into the Supabase SQL editor → click **Run** (or Cmd+Enter)
   - You should see "Success. No rows returned" — this means all the tables were created
9. Click **+ New query** again
10. Copy contents of `db/rls.sql` → paste → **Run**
    - Same "Success" message expected

### Get your project keys

11. Left sidebar → **Project Settings** (gear icon at the bottom) → **API**
12. You'll see two things you need:
    - **Project URL** (e.g. `https://abcdef.supabase.co`)
    - **anon public** key (a very long string starting with `eyJ...`)
13. Keep this tab open — you'll copy these in Step 4

---

## Step 3 — Set up GitHub Pages (10 min)

GitHub will host your live website for free.

1. If you don't have a GitHub account, sign up at <https://github.com>
2. Click **+** (top right) → **New repository**
   - Repository name: `game-time-wizard`
   - Public (required for free GH Pages)
   - **Don't** check "Add a README"
   - Click **Create repository**
3. You'll see a setup page. Look for the option **"uploading an existing file"** (link in the middle of the page)
4. Open Finder, go to `Game Time Wizard/` folder
5. Select all files and folders inside (Cmd+A), drag them into the GitHub upload area
   - Make sure you upload the **contents** of the folder, not the folder itself
   - You should see: `index.html`, `README.md`, `SCOPE.md`, `TESTING.md`, `config.js.example`, `.gitignore`, `css/`, `db/`, `js/`
6. Scroll down → **Commit changes**

### Enable Pages

7. Top of the repo → **Settings** tab
8. Left sidebar → **Pages**
9. Under "Build and deployment":
   - Source: **Deploy from a branch**
   - Branch: **main**, folder **/(root)**
   - Click **Save**
10. Wait ~1 minute. Refresh the page. You'll see: "Your site is live at `https://<your-username>.github.io/game-time-wizard/`"
11. **Copy this URL** — you need it for Step 5

---

## Step 4 — Add your Supabase keys (5 min)

The frontend needs to know where Supabase is.

1. In your `Game Time Wizard/` folder, **duplicate** `config.js.example` (right-click → Duplicate)
2. Rename the copy to `config.js` (remove `.example` and the `copy` suffix)
3. Open `config.js` in TextEdit
4. Replace the placeholder values with the real ones from Step 2.12:
   ```javascript
   window.GTW_CONFIG = {
     SUPABASE_URL:  'https://abcdef.supabase.co',     // ← yours
     SUPABASE_ANON: 'eyJhbGciOiJI...your real key...'  // ← yours
   };
   ```
5. Save the file

### Push config.js to GitHub

6. Open `.gitignore` in TextEdit
7. Find the line `config.js` and **delete it** (we want config.js to upload — the anon key is safe to publish, that's how Supabase is designed)
8. Save `.gitignore`
9. Back to your GitHub repo in the browser → **Add file** → **Upload files**
10. Drag in the new `config.js` and the updated `.gitignore`
11. **Commit changes**
12. Wait ~1 minute for GitHub Pages to redeploy

---

## Step 5 — Tell Supabase about your URL (2 min)

Supabase needs to know where to send the magic-link sign-in back to.

1. Back to your Supabase tab → left sidebar → **Authentication** → **URL Configuration**
2. **Site URL:** paste your GH Pages URL from Step 3.10 (e.g. `https://yourname.github.io/game-time-wizard/`)
3. **Redirect URLs:** add the same URL
4. Click **Save**

---

## Step 6 — Sign in and become admin (5 min)

1. Open your GH Pages URL in the browser
2. **You should see:** the basketball login screen
3. Type your email → click **Send magic link**
4. **You should see:** "Check your inbox at..."
5. Open your email, find the message from Supabase, click the **Confirm your mail** link
6. The browser opens back at your app, **signed in**
7. **You should see:** the dashboard with Sidebar (Dashboard / Teams / Roster / Games / Settings)
8. Click around — each tab shows a "Stub view" placeholder. That's correct for v1 scaffold.

### Bootstrap your admin record

The auth user exists, but you don't yet have a `staff` row that connects you to a club. Let's fix that.

9. Back to Supabase → **SQL Editor** → **+ New query**
10. Run this (replace 'My Basketball Club' with your real club name):
    ```sql
    insert into clubs (name) values ('My Basketball Club') returning id;
    ```
11. Copy the returned UUID (it'll look like `a1b2c3d4-...`)
12. Run this (paste your club UUID, your name, your email — the email MUST match the one you signed in with via magic link):
    ```sql
    insert into staff (user_id, club_id, full_name, email, is_admin)
    values (
      (select id from auth.users where email = 'mingo.bne@gmail.com'),
      'PASTE-CLUB-UUID-HERE',
      'Ming Lu',
      'mingo.bne@gmail.com',
      true
    );
    ```
    > Note: `auth.uid()` doesn't work in the Supabase SQL Editor (the editor runs as admin, not as you). The subquery above looks up your user ID from the auth table by email instead.
13. Run the seed (paste your club UUID where it says `:club_id`):
    ```sql
    -- Open db/seed.sql, copy contents, replace :club_id with your UUID, paste here, Run
    ```

---

## Step 7 — Confirm everything works

1. Reload your GH Pages URL
2. You're still signed in (session persists)
3. Sidebar shows your email at the bottom-left
4. Click **Sign out** → you go back to the login screen
5. Sign in again with magic link → you're back at the dashboard

If all of that worked, you've successfully tested the v1 scaffold end-to-end. The actual modules (Roster, Ratings, Games, etc.) are built in the next steps and will appear in those tabs.

---

## Common issues

**"I can't sign in — the magic link does nothing"**
→ Step 5 — your Supabase Site URL doesn't match your GH Pages URL exactly (trailing slash matters).

**"I see 'Setup needed' on the live site"**
→ Step 4 — `config.js` didn't upload, OR you forgot to remove it from `.gitignore`. Check the GitHub repo file list — you should see `config.js` in the file list.

**"My GH Pages URL shows a 404"**
→ Step 3.10 — wait another minute, GitHub Pages first deploy can take 5+ min. Refresh the Pages settings page to see status.

**"Magic link email never arrives"**
→ Check spam folder. Supabase free tier sends from `noreply@mail.supabase.io`. If still nothing, in Supabase go to Authentication → Logs to see if it tried.

**"I see a row-level security error in the browser console"**
→ Step 6.10–13 — your staff row isn't set up correctly. Run the SQL again.

---

When you're done testing, tell me what you saw and I'll move to step 3 (the actual setup screens that replace the manual SQL bootstrap).

---

# Step 3 — Testing the Settings + Teams build

Once step 3 is built, you re-deploy and verify the new screens.

## A. Run the migration

1. Supabase → SQL Editor → + New query
2. Copy the entire contents of `db/migration_step3.sql` → paste → Run
3. Should see "Success. No rows returned"

## B. Re-deploy the frontend to GitHub

You have new files: `js/lib/data.js`, `js/views/settings.js`, `js/views/teams.js`, `js/views/team-detail.js`. Plus updated `index.html`, `js/app.js`, `db/schema.sql`, `db/migration_step3.sql`, `README.md`.

Easiest: in your GitHub repo, **Add file → Upload files**, drag in the entire `Game Time Wizard/` folder contents again, commit. GitHub will overwrite changed files and add new ones.

Wait ~1 minute for GH Pages to redeploy.

## C. Test the new screens

1. Reload your live URL
2. **Settings → Club:** rename your club. Click Save. Reload — name persists.
3. **Settings → Staff:** you should see yourself in the list, marked Admin and Active.
4. Click **+ Invite staff**. Enter a fake name + a different email you control (or leave empty for now and Cancel).
5. **Teams** → **+ New team**. Fill in: Name "U14 Boys", Age "U14", Season "2026 Winter", Rule mode "Equal Opportunity", periods 4, minutes 8 (junior format). Create.
6. You're auto-redirected to the new team's detail page.
7. Click **+ Assign staff** → pick yourself → Role "Head Coach" → Assign.
8. You should appear in the Staff on this team table.
9. Click **← Back to teams** — your team appears in the list.

If all of that works, step 3 is complete. Tell me and I'll move to step 4 (Roster).

---

# Step 4 — Testing the Roster build

No SQL migration needed for step 4 (the players/families/contacts tables already exist).

## A. Re-deploy

Upload the updated `index.html`, the new `js/views/roster.js`, and the updated `js/lib/data.js` to your GitHub repo.

## B. Walk through

1. Reload your live URL → click **Roster** in the sidebar
2. Top of page shows your team selector. If you have only one team, it auto-selects.
3. **Families tab first** (recommended order — players link to families):
   - Click **+ Add family**, enter "Smith", Save
   - On the Smith family card, click **+ Add contact**, enter Name "Jane Smith", Relationship "Mother", Phone, Email, tick "Primary contact", Add contact
   - Repeat: add a second contact "John Smith / Father"
   - Click the ★ next to John to make him primary instead — Jane's star should go grey
4. **Players tab:**
   - Click **+ Add player**
   - Name "Alex Smith", Jersey 24, DOB (a junior date so age makes sense)
   - Family: select "Smith" from dropdown
   - Click positions PG and SG to highlight them
   - Leave Active checked
   - Add player
5. The new player appears in the table with: jersey 24, age (computed), positions "PG, SG", family "Smith", Active green badge
6. Click **Edit** on the player → change something → Save → confirm change persists
7. Refresh page → both tabs still show your data

## C. Permissions check (optional)

If you have an Assistant Coach or Team Manager staff record, sign in as them — they should see Roster but only have view+edit access for teams they're assigned to. (Admin sees everything.)

## D. Common issues

**"Roster shows 'No teams to manage'"**
→ You're not assigned to any team and you're not a club admin. Either go to Teams and create one (admin), or add a team_staff assignment.

**"I get a permission error when adding a player"**
→ The RLS policy needs you to be assigned to that team via team_staff (or be admin). Go to Teams → click the team → Staff section → assign yourself.

If everything works, tell me and I'll move to step 5 (Ratings — 11 sub-skills with sum/average display).

---

# Step 4.5 — Testing the club-level player restructure

## A. ⚠️ Run the migration (DESTRUCTIVE — wipes any test players/families/ratings)

This was confirmed safe to run because no real player data has been entered yet.

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step4_5.sql`
3. Run
4. Should see "Success. No rows returned"

Verify with:
```sql
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('players','families','team_memberships','ratings');
-- Should return 4 rows
select column_name from information_schema.columns
 where table_name = 'players' order by ordinal_position;
-- Should show: id, club_id, family_id, full_name, dob, photo_url, notes, created_at, updated_at
-- (no team_id, no jersey_no, no positions, no is_active)
```

## B. Re-deploy the frontend

Upload changed files: `index.html`, `js/lib/data.js`, `js/views/roster.js`, `db/schema.sql`, `db/rls.sql`.

## C. Test the new model

1. Reload your live URL → click **Roster**
2. **Families tab:** add "Smith" family + a primary contact (the ★ now enforces single-primary — clicking ★ on contact B will un-star contact A)
3. **Players tab:** click **+ New player**, fill in Alex Smith (jersey 24, position PG/SG, family Smith), Add to club + roster
4. Alex appears in your team's roster
5. **Cross-team test:** create a second team in Teams (e.g. "U16 Boys"), assign yourself as Head Coach, then come back to Roster
6. In the team selector, switch to U16 Boys
7. You should see a new button "**+ From club**" — click it, pick Alex Smith from the dropdown, give him jersey 12 + different positions, Add to roster
8. Now switch back to the U14 team — Alex still has jersey 24 there. Switch to U16 — he has jersey 12.
9. On either team, you'll see a small "Also on: U14 Boys" badge under Alex's name on the U16 roster (and vice versa).

## D. Verify the per-team independence

10. Edit Alex on U14 — change his jersey to 7. Save.
11. Switch to U16 — his jersey there is still 12. Confirmed: jerseys are per team.
12. Edit Alex's name on U14 (he becomes "Alex S Smith"). Save.
13. Switch to U16 — he's "Alex S Smith" there too. Confirmed: name is club-level.

## E. Verify deletion behaviour

14. On U14 roster, click "Remove from team" on Alex. Confirm. He's off U14.
15. Switch to U16 — he's still there. Confirmed: removing from team ≠ deleting from club.
16. (Optional) Re-add Alex to U14 with "+ From club" — he's still in the club, picker shows him.

If all of that works, the restructure holds. Tell me — I'll move to step 5 (per-team Ratings).

---

# Step 4.6 — Testing the cross-tool data foundation

This adds Tier 1 + Tier 2 entities: seasons, opponents, player demographics, plays + stats view, player preferences, game scores. Foundation for integrating Game Time Wizard with Citipointe Team Mgmt + CourtSide Stats — no future schema rework required.

## A. Run the migration (data-preserving)

Existing teams.season text + games.opposition text are migrated to the new entities before the columns are dropped. Safe to run with existing data.

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step4_6.sql` → Run
3. Should see "Success. No rows returned"

Verify with:
```sql
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('seasons','opponents','player_preferences','plays');
-- Should return 4 rows

select count(*) from seasons;
-- Should be at least 1 ("Default Season" auto-created per club)

select column_name from information_schema.columns
 where table_name='players'
   and column_name in ('gender','first_year_of_play','primary_school','phone','email','external_ids','is_active_in_club');
-- Should return 7 rows

select column_name from information_schema.columns
 where table_name='games'
   and column_name in ('opposition_id','team_score','opposition_score','result');
-- Should return 4 rows
```

## B. Re-deploy

Upload the changed files: `index.html`, `js/lib/data.js`, `js/views/teams.js`, `js/views/team-detail.js`, `db/schema.sql`, `db/rls.sql`, `db/migration_step4_6.sql`. Commit, wait 1 min for GH Pages.

## C. Test that nothing broke

1. Reload your live URL → sign in as normal
2. Click **Teams** — your existing teams still appear (Season column has been removed, that's expected — Settings → Seasons UI lands in a later step)
3. Click into a team — settings still load and save correctly
4. Click **Roster** — your players + families still load and save correctly
5. **Settings** still loads, Club + Staff tabs work

## D. (Optional) Spot-check the new entities exist

In Supabase → Table Editor:
- `seasons` should have at least one row ("Default Season")
- `opponents` is empty (no games yet)
- `players` table now has 7 new columns visible
- `games` table has new columns (opposition_id, team_score, opposition_score, result)
- `player_preferences` is empty (Citipointe intake hasn't been wired yet)
- `plays` is empty (CourtSide hasn't been wired yet)

## E. What's deferred to later UI work

The foundation is in place but not all of it is exposed in the UI yet. Coming in later steps:

- **Settings → Seasons** management (create/rename/set-current)
- **Settings → Opponents** management (with logos, colors)
- **Roster** form: gender, first year of play, primary school, player phone/email, external IDs (jsonb editor or simple key-value pairs)
- **Games** form: opponent dropdown (powered by `opponents` table)
- **Per-game data**: score + result entry post-game
- **CourtSide bridge**: a stats viewer in Game Time Wizard reading `plays` + `player_game_stats` view

If everything still works after re-deploy, the foundation is solid. Tell me and I'll continue with step 5 (per-team Ratings UI).

---

# Step 5 — Testing the Ratings module

No SQL migration needed for step 5 (the ratings table was rebuilt in step 4.5).

## A. Re-deploy the frontend

Upload the updated `index.html`, `js/app.js`, `js/lib/data.js`, and the new `js/views/ratings.js` to your GitHub repo. Wait 1 min for GH Pages.

## B. Walk through

1. Reload your live URL — you should see a new **⭐ Ratings** tab in the sidebar (mobile bottom nav now has 6 items)
2. Click **Ratings** → team selector at top picks up your last-used team
3. **Permission check:** if you're a Head Coach of this team, you'll see editable cards. If you're admin-only (not assigned as head_coach), you see a "Read-only — only the team's Head Coach can edit ratings" banner.
4. Each player on the team's roster appears as a card with:
   - Jersey + name + "Not rated yet" tag (if no rating exists)
   - Or category sums (Phys/Skills/IQ) + Total/55 if rated
5. Click a card to expand into the rating editor
6. For each of the 11 sub-skills, click 1–5 to set the score. Selected button highlights brand orange.
7. Category sums and averages update live as you click.
8. Optionally add a Notes line.
9. Click **Save rating** — card collapses, summary shows new totals.
10. Re-open to edit; or **Clear rating** to wipe and start over.

## C. Verify cross-team independence (the whole point of per-team ratings)

If you have the same player on two teams (set up during 4.5 testing):
1. Rate Alex on U14 — give him 5 in Speed, save.
2. Switch team selector to U16 (or whatever the second team is).
3. Alex appears as "Not rated yet" on U16 — confirming ratings don't cross teams.
4. Rate him differently on U16 (e.g. 3 in Speed). Save.
5. Switch back to U14 — his Speed is still 5. Confirmed: same human, different ratings per team context.

## D. Team summary

At the top of the Ratings view, three stats: **Rated** (count), **Unrated** (count), **Team avg** (average of total averages across rated players). Use this for a quick on-court 5 balance read.

## E. Common issues

**"I don't see the Ratings tab"** → Hard reload (Cmd+Shift+R) — old cached HTML may still be loaded.

**"Save errors with permission denied"** → You're not assigned as Head Coach of this team. Go to Teams → click team → Staff section → set your role to Head Coach (admin can do this).

If everything works, tell me and I'll move to step 6 (Schedule + Game Week shell — the biggest remaining module).

---

# Step 6 — Testing the Schedule + Game Week shell

No SQL migration needed (games table exists from step 1; opposition_id and game scores added in step 4.6).

## A. Re-deploy the frontend

Upload changed files: `index.html`, `js/lib/data.js`, plus the two new files `js/views/games.js` and `js/views/game-week.js`. Wait 1 min for GH Pages.

## B. Walk through the Games list

1. Reload your live URL → click **📅 Games** in the sidebar
2. Team selector at top picks up your last-used team
3. Click **+ New game** → fill in:
   - Date (any date this week)
   - Time (e.g. 10:30)
   - Opposition: pick from dropdown OR click **+ New** to add one inline (e.g. "Belmont Pointers"), then pick it
   - Venue (e.g. Auchenflower Stadium), Court (e.g. Court 2)
   - Periods + minutes default to your team's settings (override if non-standard)
   - Status: Scheduled
   - Save
4. Game appears in the table with date, opposition, venue, format, "Scheduled" badge
5. Click the date → opens the **Game Week** screen

## C. Walk through the Game Week screen

1. Game header shows team, opposition, date, time/venue/court/format, status badge, days-to-go indicator
2. Three workflow cards:
   - **Day -7 to -3:** Availability request — placeholder for step 9
   - **Day -2:** Logistics + duty reminder — placeholder for steps 7+9
   - **Day -1:** Game day notice + rotation — placeholder for steps 8+9
   - The card matching your current window (based on days-to-go) gets a brand-orange "Now" badge and tinted background
3. **Post-game card** at the bottom is functional:
   - Set status to "Completed", enter team_score and opposition_score
   - Result auto-computes (win/loss/draw) when both scores are set + status is completed
   - Add coach notes
   - Save → reload page, values persist

## D. Round trip back to the list

1. Click **← Back to games** → you're back at the games list
2. Edit the game (pencil icon) — change time or notes, save
3. Verify changes appear in the list and on the Game Week screen

## E. Common issues

**"Opposition dropdown is empty"** → No opponents exist yet for this club. Use the **+ New** button next to the dropdown to add one inline.

**"Inline opponent add gives a duplicate name error"** → Opponent name already exists for this club (uniqueness constraint). Pick from the dropdown instead.

If everything works, the spine of the app is in place. Tell me and I'll continue with step 7 (Bench Duty engine — fills in the Day -2 workflow card).

---

# Step 6.5 — Testing the division + age_group filter

## A. Run the migration

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step6_5.sql` → Run
3. Should see "Success. No rows returned"

Verify:
```sql
select column_name from information_schema.columns
 where table_name='teams' and column_name='division';
-- 1 row

select column_name from information_schema.columns
 where table_name='opponents' and column_name in ('age_group','division');
-- 2 rows
```

## B. Re-deploy the frontend

Upload changed files: `index.html`, `js/lib/data.js`, `js/views/teams.js`, `js/views/team-detail.js`, `js/views/games.js`, `db/schema.sql`, `db/migration_step6_5.sql`. Wait 1 min for GH Pages.

## C. Walk through

1. **Update an existing team** (Teams → click team → Settings) — set Age Group "B10" and Division "Div 5". Save.
2. **Open Games** → **+ New game** → opposition dropdown should be empty (no opponents tagged B10/Div 5 yet). Click **+ New** opponent.
3. The inline opponent form is now richer: name, age group, division — pre-filled with B10 / Div 5. Add "Belmont Pointers" — saves with B10/Div 5 tags.
4. Belmont appears in the dropdown showing "Belmont Pointers (B10 / Div 5)".
5. Add a second opponent in a different bracket (e.g. "Some Other Team", manually change age_group to B12, Div 3). Save.
6. Opposition dropdown only shows Belmont (B10 / Div 5 matches your team). Some Other Team (B12 / Div 3) is hidden by the filter.
7. Untick **Filter by team's age group + division** → both opponents now visible (useful for friendlies / lightning matches).
8. **Re-grading test:** Edit your team, change Division to "Div 4". Open Games again, opposition dropdown is now empty (no B10/Div 4 opponents). Add one, or untick the filter to use existing.

If filtering behaves correctly, division design holds. Tell me and I'll continue with step 7 (Bench Duty).

---

# Step 6.6 — Testing gender on teams + functional dashboard

## A. Run the migration

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step6_6.sql` → Run
3. Should see "Success. No rows returned"

## B. Re-deploy the frontend

Upload changed files: `index.html`, `js/lib/data.js`, `js/views/teams.js`, `js/views/team-detail.js`, the new `js/views/dashboard.js`, `db/schema.sql`, `db/migration_step6_6.sql`. Wait 1 min for GH Pages.

## C. Test gender on teams

1. **Teams** → **+ New team** — Gender dropdown now appears (Boys / Girls / Mixed / Open / Adult). Pick one.
2. Save → new column "Gender" in the teams list shows "Boys" / "Girls" etc.
3. Open a team → Settings tab → Gender dropdown shows current value, editable.
4. Team detail header now reads e.g. "U10 · Boys · Div 5".
5. Existing teams created before this change have Gender = "—" until you edit them and pick a value.

## D. Test the dashboard

1. Click **📋 Dashboard** in the sidebar (or hard-reload home).
2. Should see your name in the welcome line.
3. **Stat cards (4 across):** Teams, Players, Upcoming games, Staff — each clickable to its respective page.
4. **Next 5 games:** if you have upcoming games, they appear sorted by date with team, opposition, date/time/venue, and a coloured "In N days" / "Today" / "Tomorrow" indicator. Click any game → opens its Game Week screen.
5. If no games upcoming, an empty-state prompts you to add one.
6. **Quick links** at the bottom: Manage roster / Update ratings / Schedule game / Settings — all clickable shortcuts.

## E. Common issues

**"Dashboard says counts but no upcoming games even though I have games"** → Check the games are dated TODAY or in the future (past games and cancelled games are filtered out).

**"Gender dropdown shows blank for old teams"** → Existing teams created before step 6.6 have null gender. Edit each team and pick a value.

If both work, tell me and I'll continue with step 7 (Bench Duty).

---

# Step 7 — Testing Bench Duty engine

No SQL migration needed for step 7 (the duty tables already exist from step 1).

## A. Re-deploy

Upload changed files: `index.html`, `js/lib/data.js`, `js/views/team-detail.js`, `js/views/game-week.js`. Wait 1 min.

## B. Set up the duty pool

1. Make sure your team has players with **family links** (Roster → Players → each player must have a Family selected). Without family links, the duty pool will be empty.
2. Open Teams → click a team → scroll to the **Bench duty** section
3. **Duty pool** appears on the left listing every family with at least one active player on this team

## C. Generate the roster

1. Make sure you have at least 2-3 upcoming scheduled games (Games → + New game)
2. Click **Generate roster** — should pop an alert with assignment summary
3. **Duty roster** on the right populates with date → family rows
4. The fairness algorithm picks the family with the fewest current duties; ties broken alphabetically

## D. Test exclusions

1. Click **+ Add exclusion** on a family
2. Pick "One-off date" → set the date to one of your upcoming games → reason "travelling"
3. Save
4. Click **Generate roster** again → that family is skipped for THAT date; another family takes the slot
5. Try a "Date range" exclusion (e.g. all of next week)
6. Try "Full season" with no dates → that family is excluded from ALL upcoming games

## E. Test locks + manual override

1. On a duty assignment, click the 🔓 icon → it changes to 🔒 (locked)
2. Click **Generate roster** again → the locked assignment doesn't change
3. Click **Clear** on an assignment → removed
4. Open a Game Week (Games → click a game)
5. Day -2 card now shows the assigned bench duty family
6. Click **Reassign** → pick a different family from the dropdown → Save
   - Manual reassignment auto-locks the slot (won't be reshuffled by Generate Roster)
7. Click **Clear** to remove

## F. Common issues

**"Duty pool is empty" / "Add players (with family links) to this team first"** → Open Roster → for each player, click Edit and select a Family from the dropdown. Players without a family aren't represented in the duty pool.

**"Generate roster says X games had no eligible family"** → Some games have all families excluded for that date. Check exclusions or add more families.

**"Reassign dropdown is empty on Game Week"** → The team has no families with active players. Same fix as above.

If everything works, the duty engine is in place. Tell me and I'll continue with step 8 (Equal Opportunity Rotation engine — the biggest algorithm in the project).

---

# Step 7.5 — Testing player-based bench duty (reversal of step 7)

⚠️ This **wipes any duty assignments and exclusions** you created in step 7 testing (they were family-based, now player-based — not 1:1).

## A. Run the migration

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step7_5.sql` → Run

## B. Re-deploy

Upload changed files: `index.html`, `js/lib/data.js`, `js/views/team-detail.js`, `js/views/game-week.js`, `db/schema.sql`, `db/rls.sql`, `db/migration_step7_5.sql`. Wait 1 min.

## C. Test the player pool

1. Open Teams → click a team → scroll to **Bench duty**
2. **Duty pool** now shows PLAYERS (not families). Each row: checkbox · player name · family name (small) · current duty count
3. **Sibling test:** if you have two siblings on the team (Alex + Sam Smith), both default to ticked. Untick Sam → only Alex carries duty for the Smith family.
4. Pool counter at top reads e.g. "7 of 8 players in rotation"
5. Add an exclusion to a player (one-off date / range / full season) — same UX as before, just per-player now

## D. Generate roster

1. Click **Generate roster** → assignments go to PLAYERS
2. Roster shows: date · vs opposition · 🪑 Player Name · Family Name (greyed)
3. Reshuffle works the same as before; locked assignments stay

## E. Game Week reassign

1. Open any game → Day -2 card shows the assigned player (with family in parens)
2. Click **Reassign** → dropdown shows duty-eligible players (siblings you unticked are NOT in the dropdown)
3. Assign a different player → auto-locks

## F. Availability-aware re-generation (advanced)

Once availability tracking ships in step 8, you'll be able to:
1. Mark a player unavailable for a specific game
2. Click Generate Roster again on the team page
3. The algorithm skips that player for that specific game and gives the duty to the next eligible player by count

For now, you can test this manually by inserting an availability row in Supabase:
```sql
insert into availabilities (game_id, player_id, status)
values ('<game-uuid>', '<player-uuid>', 'unavailable');
-- then re-run Generate Roster — that player won't be picked for that game.
```

If the player-based duty works, tell me and I'll continue with step 8 (Rotation Engine).

---

# Step 8 — Testing the Equal Opportunity Rotation engine

No SQL migration needed (rotation_plans + availabilities tables already exist).

## A. Re-deploy

Upload changed files: `index.html`, `js/lib/data.js`, the new `js/lib/rotation.js`, `js/views/game-week.js`, `css/app.css`. Wait 1 min.

## B. Pre-requisites

- Your team needs `rule_mode = 'equal_opportunity'` (Junior). For senior teams (No Engine), the Day -1 card shows a step-10 placeholder.
- At least 5 active players on the roster
- A scheduled game

## C. Set availability

1. Open the game's Game Week screen → scroll to Day -1 card
2. Click **▶ Show availability list**
3. For each player, click ✓ In / ✗ Out / 🤕 Injured. The header updates: ✓ N available · ✗ N out · 🤕 N injured · ? N unconfirmed
4. Or click **Mark all unconfirmed as Available** to fast-fill

## D. Generate the rotation

1. Click **Generate** in the Rotation plan section
2. Algorithm runs immediately (it's all client-side)
3. A matrix appears: rows = players, columns = substitution blocks (Q1 0-2, Q1 2-4, ...), cells = ● (on court) or · (off)
4. Far-right column shows total minutes per player — should be approximately equal across players (±1-2 min depending on roster size and game format)

## E. Verify fairness

1. Note the per-player minute totals — they should be very close (e.g. 8 players × 32 min game / 8 = 20 min each, with possible 18/19/20 split)
2. Test edge cases:
   - **Exactly 5 available** → everyone plays the whole game (no subs)
   - **Fewer than 5 available** → error: "Need at least 5 available players"
   - **8+ available with mixed game formats** (try a team with 4×8 and another with 2×20)

## F. Lock + regenerate

1. Click 🔓 to lock the plan — icon changes to 🔒
2. Try **Regenerate** — confirmation says "Plan is locked. Unlock and regenerate?"
3. Decline → plan unchanged
4. Unlock manually → 🔒 → 🔓 → Regenerate freely

## G. Print

1. Click 🖨️ Print → browser print dialog opens
2. Preview should show ONLY the rotation chart (sidebar/nav hidden, on-court cells stay visible in greyscale)
3. Print or save as PDF for the bench

## H. Re-run after availability change

1. Mark a player as Out (was previously Available)
2. Regenerate the rotation → the now-unavailable player is excluded; everyone else's minutes adjust upward

## I. Common issues

**"No plan generated yet"** despite players being available → Check that they're marked **Available** specifically (the algorithm only picks confirmed-available players, not unconfirmed).

**Print preview shows the whole app, not just the chart** → Hard reload after deploy (Cmd+Shift+R) to pick up new print CSS.

**Per-player minutes look uneven** → That's expected if the math doesn't divide evenly (e.g. 9 players × 32 min × 5 / 9 = 17.78 min each → some get 18, some 17). The algorithm minimises spread but can't make it perfect.

If everything works, the engine is in place. Tell me — I'll continue with step 9 (Comms templates: the three copy/paste messages).

---

# Step 8.5 — Testing per-team sub block + borrowed players

## A. Run the migration

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step8_5.sql` → Run

## B. Re-deploy

Upload changed files: `index.html`, `js/lib/data.js`, `js/lib/rotation.js`, `js/views/teams.js`, `js/views/team-detail.js`, `js/views/game-week.js`, `db/schema.sql`, `db/rls.sql`. Wait 1 min.

## C. Configure per-team sub block size

1. Open Teams → click a team → Settings tab
2. New field **Sub block (min)** below "Minutes per period". Default is 2.
3. For your U10 team: set to 5. For U14: set to 10. Save.
4. The next rotation generated for that team uses the new block size.

## D. Verify block size actually applies

1. Open a game on the U14 team (with rotation_block_minutes = 10) → Day -1 card → Generate rotation
2. Matrix columns should show Q1 0-10, Q2 0-10, Q3 0-10, Q4 0-10 (effectively quarter-locked subs)
3. Switch to a U10 team game → Generate → columns should be 5-min blocks (Q1 0-5, Q1 5-8 if quarter is 8 min, ...)

## E. Borrow a player

1. On any Game Week → scroll to **Borrowed players for this game**
2. Click **+ Borrow player**
3. Search box filters players from your club NOT on this team. Pick one (radio).
4. Pick a priority weight: 0.25 / 0.50 (default) / 0.75 / 1.00
5. Click **Add as borrowed**
6. Player appears in the borrowed list AND in the availability list with a yellow `Borrowed · w0.5` badge

## F. Generate rotation with borrowed players

1. Mark all players (regulars + borrowed) as Available
2. Click Generate
3. The borrowed player appears in the rotation matrix with "(borrowed)" suffix on their name
4. Their total minutes should be roughly half (or whatever weight × regular share) of a regular player's minutes

Math check: 8 regulars + 1 borrowed (w=0.5) in 32-min game (160 court-min):
- Total weighted = 8 + 0.5 = 8.5
- Regular share: 160/8.5 = ~18.8 min each
- Borrowed share: 0.5 × (160/8.5) = ~9.4 min
- Sums to 8 × 18.8 + 9.4 = ~160 ✓

## G. Adjust weight

1. In the borrowed players list, change a borrow's weight dropdown
2. Click Regenerate rotation → new matrix reflects the updated weight

## H. Remove borrow

1. Click Remove next to a borrowed player → gone
2. Their availability is also implicitly removed (no longer in eligible list)

## I. Common issues

**"Borrowed player isn't appearing in rotation"** → Check they're marked Available in the availability list (the algorithm only picks confirmed-available players, regular or borrowed).

**"Block size of 7 in a 8-min period creates weird columns"** → That's expected — the last block of the period is partial (7 + 1). Algorithm handles it but the chart looks asymmetric. Pick a block size that divides cleanly into the period (2, 4, 8 for 8-min periods; 5 or 10 for 10-min; etc.).

If everything works, tell me and I'll continue with step 9 (Comms templates).

---

# Step 8.6 — Testing manual rotation editing (covers senior scratch pad too)

No SQL migration needed.

## A. Re-deploy

Upload changed files: `index.html`, `js/views/game-week.js`. Wait 1 min.

## B. Test on a JUNIOR team (override the algorithm)

1. Open a junior team game → Day -1 card → Generate rotation
2. Matrix appears with ● and · cells
3. Each cell now has hover feedback (`:cursor-pointer` + ring on hover) — they're clickable
4. **Tap an on-court ● cell** → it highlights yellow with a ring
5. A yellow banner appears at the top: "🔄 Selected for swap. Tap an off-court cell in the same column…"
6. **Tap an off-court · cell in the SAME column** → players swap. Yellow highlight clears.
7. Per-player Min totals (right column) recompute live
8. Tap an on-court cell again → cancel selection (or click the Cancel button in the banner)

## C. Test "block has space" (senior or borrow scenario)

1. On a junior team, click the ❌ next to any player on a block (visible only when canEdit) — wait, removal isn't on the cells
2. Actually: tap an on-court cell (selecting), then tap an off-court cell in same column to swap. To leave only 4 on court, you'd need a different action.
3. **Easier test: use a senior team for empty-plan testing (next section).**

## D. Test on a SENIOR team (build from scratch)

1. Edit a team → set Rule mode to **No Engine** → Save
2. Open a game on that team → Day -1 card
3. Set 5+ players to Available
4. Click **Start empty plan** → matrix appears with all cells as `+` (off court, ready to add)
5. **Tap any `+` cell** → that player is added to that block (cell becomes ●)
6. Add up to 5 players in the same column
7. After 5 are on, the column behaves like the junior case — tap on-court to mark for swap, tap off-court to swap them in

## E. Lock the plan

1. Click 🔓 to lock — icon becomes 🔒
2. Try Generate (junior only) → confirms "Plan is locked. Unlock and regenerate?"
3. Manual edits still work even when locked (the lock just protects from regenerate / accidental clear)

## F. Common issues

**"Cells aren't clickable"** → `canEdit()` returned false. Check that you're a club admin or staff on the team.

**"+ cells not showing in some columns"** → Those columns might be already at 5 on court AND no swap selected. Tap a ● cell first to enable swap mode for that column.

**"After regenerate, my manual edits are gone"** → Lock the plan (🔒 button) before regenerating to protect manual edits. ADR-019 design — locked plans are never overwritten by Generate.

If both junior override and senior empty-build scenarios work, we're done. Tell me and I'll continue with step 9 (Comms templates).

---

# Step 8.7 — Testing tile-based Teams + team color

## A. Run the migration

1. Supabase → SQL Editor → + New query
2. Paste contents of `db/migration_step8_7.sql` → Run

## B. Re-deploy

Upload changed files: `index.html`, `js/lib/data.js`, `js/views/teams.js`, `js/views/team-detail.js`, `db/schema.sql`, `db/migration_step8_7.sql`. Wait 1 min.

## C. Visual check

1. Open **Teams** — table is gone. You see tiles in a responsive grid (1 column on phone, up to 4 on desktop).
2. Each tile has: thin color band on top, team name (large), context line (age/gender/division), format + mode summary. Hover → border darkens + soft shadow + arrow turns brand-orange.
3. Click anywhere on the tile → opens that team's detail page.

## D. Set a team color

1. Edit a team (Teams → tile → Settings) — new **Team color** picker appears below the format row.
2. 14 preset swatches. Click one → picker shows ring around your selected colour. Or type a custom hex (e.g. `#1e3a8a`).
3. Save → the team detail page header band changes to your chosen colour.
4. Go back to Teams → that team's tile band reflects the new colour.

## E. Color propagates across the app

5. **Dashboard:** Upcoming games list now shows a small color dot next to each team-vs-opposition line.
6. **Game Week:** Game header card has the team's color band at the top.
7. (More surfaces — game cards, comm message previews — pick up the color in subsequent steps.)

## F. Quick-jump from team detail

1. Open a team detail. Below the header band, three action buttons: **🏀 Roster**, **⭐ Ratings**, **📅 Games**.
2. Click any → that page opens with the team auto-selected (uses localStorage `gtw_last_team`).

## G. Common issues

**"Tiles look the same color"** → Existing teams have null `color` until you edit them. Default fallback is slate (#475569). Edit each team and pick a distinctive colour.

**"Custom hex isn't applying"** → Make sure you include the `#` prefix and use 7 chars total (e.g. `#1e3a8a`, not `1e3a8a`).

If the visual works, tell me and I'll continue with step 9 (Comms templates — the last functional module).














