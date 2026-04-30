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
12. Run this (paste your UUID, your name, your email):
    ```sql
    insert into staff (user_id, club_id, full_name, email, is_admin)
    values (auth.uid(), 'PASTE-CLUB-UUID-HERE', 'Ming Lu', 'mingo.bne@gmail.com', true);
    ```
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
