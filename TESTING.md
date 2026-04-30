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




