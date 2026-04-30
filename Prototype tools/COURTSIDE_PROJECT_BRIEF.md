# CourtSide Stats — Project Brief

## What This Is

A single-file Progressive Web App for real-time basketball statistics tracking. Built for iPhone sideline use — installed to home screen via Safari, runs fully offline, stores all data locally. No backend, no accounts, no dependencies beyond the browser.

**Live:** `https://mingo-bne.github.io`  
**Repo:** `https://github.com/mingo-bne/mingo-bne.github.io`  
**Stack:** Vanilla HTML/CSS/JS · localStorage · PWA (manifest + service worker)  
**Primary file:** `index.html` (self-contained, ~3,900 lines)

---

## Current Feature Set

### Header (Game Setup)
- **Team selector** — compact 80×80px tile with logo, name, tap to open modal grid
- **Opponent selector** — compact tile matching team selector style, tap to open modal grid
- **Date selector** — iOS-style 📅 tile showing month + day, opens custom calendar modal
- All three tiles are `flex: 1` (team/opponent) and `fixed 80px` (date) so combined width never exceeds the New Game button below
- **+ New Game** button — green, full width; replaced by active game status display once game is created
- **🔒 End Game** button — red, full width; only visible when an active game is loaded

### Management Modals (header buttons)
- **🏀 Teams** — create/edit/delete teams (name, colour, logo upload); manage reusable opponents list
- **🏆 Games** — browse game history; load, edit, duplicate, delete games
- **👥 Roster** — add/remove players per team (jersey number + name)

### Dual Entry Panels
- Two panels side-by-side: Panel A (navy) and Panel B (gold)
- Each panel independently holds a player + last stat selection
- Tap panel to activate; tap again when inactive to activate without clearing
- Player selection via full-screen jersey grid modal
- Stat is locked to last selected until changed

### Stat Categories (9 total)
`2PT · 3PT · 1PT (Free Throw) · Rebound (Offensive/Defensive) · Assist · Steal · Block · Turnover · Foul`

### Play Log + Undo
- Live play-by-play list below panels
- Each entry: player name, stat type, timestamp
- Undo removes last play and reverses stat

### Stats Summary
- Per-player totals updated in real time
- Shooting percentages: FG%, 3P%, FT%
- CSV export button

### Data
- All data in `localStorage` under key `basketballTeams`
- Structure: `{ teams: {}, opponents: [], currentTeamId, currentGameId }`
- Team logos stored as base64 data URLs
- Auto-saves on every stat entry, opponent/date change, and game creation

### PWA
- `manifest.json` — relative paths, `start_url: "./"`, `scope: "./"`
- `service-worker.js` — network-first strategy, no pre-caching, auto-cleans old SW on registration
- iOS meta tags: `apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover`

---

## Data Structures

### teams object
```javascript
teams = {
  "team_1234567890": {
    id: "team_1234567890",
    name: "B14 Navy",
    color: "#1e3c72",
    logo: "data:image/png;base64,...",  // or null
    created: "2026-02-10T00:00:00.000Z",
    players: [
      { jersey: "4", name: "Luca" },
      { jersey: "63", name: "Romeo" }
    ],
    games: [
      {
        id: "game_1234567890",
        opponent: "Belmont Pointers",
        date: "2026-02-10",
        isActive: false,
        endTime: "2026-02-10T11:30:00.000Z",
        playLog: [
          {
            id: "play_1234567890",
            jersey: "4",
            playerName: "Luca",
            stat: "2pt",
            made: true,
            timestamp: "2026-02-10T10:15:00.000Z"
          }
        ],
        stats: {
          "4": {
            "2pt_made": 8, "2pt_attempted": 12,
            "3pt_made": 2, "3pt_attempted": 5,
            "ft_made": 4, "ft_attempted": 4,
            "oreb": 1, "dreb": 3,
            "assist": 4, "steal": 2,
            "block": 0, "turnover": 2, "foul": 1
          }
        }
      }
    ]
  }
}
```

### opponents array
```javascript
opponents = ["Belmont Pointers", "Redcliffe Suns", "Chermside Hawks"]
```

### Panel state (runtime only, not persisted)
```javascript
panels = {
  A: { jersey: "4", playerName: "Luca", lastStat: "2pt", active: true },
  B: { jersey: "63", playerName: "Romeo", lastStat: "steal", active: false }
}
```

---

## Key Functions Reference

| Function | What it does |
|----------|-------------|
| `initApp()` | Load localStorage, populate selectors, restore state |
| `switchTeam(teamId)` | Save current, load new team, update display |
| `quickCreateGame()` | Validate team/opponent/date, create game, enable entry |
| `loadGameData(gameId)` | Populate panels, stats, play log from saved game |
| `endCurrentGame()` | Mark game ended, disable entry, update UI |
| `recordStat(stat, panelId)` | Log play, update stats, save, re-render |
| `undoLastPlay()` | Remove last play log entry, reverse stat |
| `saveAllData()` | Write full state to localStorage |
| `loadAllData()` | Read and parse localStorage |
| `showTeamsModal()` | Open teams management modal |
| `showGamesModal()` | Open games history modal |
| `showRosterModal()` | Open roster modal |
| `showTeamSelectorModal()` | Open header team picker grid |
| `showOpponentSelectorModal()` | Open header opponent picker grid |
| `showDatePickerModal()` | Open custom calendar modal |
| `renderStats()` | Rebuild stats summary table |
| `renderPlayLog()` | Rebuild play-by-play list |
| `updateTeamDisplay()` | Update header team tile (logo + name) |
| `renderGameSelector()` | Show/hide New Game vs active game display + End Game button |
| `exportStats()` | Generate and download CSV |

---

## Known Issues / Incomplete

- **PWA 404 from home screen** — intermittent; believed to be stale service worker from previous version. Fix deployed (network-first SW + auto-cleanup of old registrations). May require user to delete and re-add app.
- **Themes** — three themes exist in CSS (Default, Liquid Glass, Titanium) but the theme selector UI was not confirmed as present in the final version. Default theme has specific overrides for white-on-white text in header.
- **Duplicate `switchTeam` function** — two definitions exist at lines ~2931 and ~3122. The one at ~2931 accepts a `teamId` argument and is the current version; the one at ~3122 reads from the selector. Consolidation needed.
- **Opponent logos** — opponents are plain strings. No logo support for opposing teams.
- **No score tracking** — team score / opponent score not tracked.
- **No period/quarter tracking** — all plays are flat within a game.
- **No player minutes** — no time tracking.

---

## Planned / Potential Next Features

- [ ] Score tracking (running team + opponent score)
- [ ] Quarter/period support
- [ ] Game summary report (printable or shareable)
- [ ] iCloud or Dropbox export for backup
- [ ] Opponent logo support
- [ ] Multi-team game (track both teams)
- [ ] Season statistics aggregation across games
- [ ] Player efficiency rating calculation

---

## Development Notes

### Working Approach
- Always work from the current `index.html` — it's the single source of truth
- Blank page = JavaScript syntax error; revert rather than debug incrementally
- After any structural edit, verify no duplicate function definitions or orphaned braces

### CSS Architecture
- Mobile-first with `@media (max-width: 768px)` overrides
- Three theme classes on `body`: `theme-default`, `theme-liquid-glass`, `theme-titanium`
- Glass-morphism pattern: `backdrop-filter: blur(20px)`, `rgba(255,255,255,0.2)` backgrounds
- iOS scrolling: every scrollable container needs `overflow-y: auto` + `-webkit-overflow-scrolling: touch`

### PWA Rules (hard-learned)
- All paths must be relative (`./`) — absolute paths break GitHub Pages subdirectory deployments
- Service worker must be network-first — pre-caching causes 404s on home screen launch
- Always unregister old service workers before registering new one
- `scope: "./"` in both manifest and SW registration

### Adding a New Modal
1. Add HTML `<div id="newModal" class="modal">` with `.modal-content`, `.modal-header`, `.modal-body`
2. Add `overflow-y: auto; -webkit-overflow-scrolling: touch` to any scrollable list inside
3. Add `showNewModal()` and `closeNewModal()` functions
4. Expose both on `window` at the bottom of the script block
5. Wire button `onclick`

### Adding a New Stat
1. Add button in `.stat-categories` section with `onclick="selectStat('newstat')"`
2. Add case in `recordStat()` switch statement
3. Initialise `newstat: 0` in `initPlayerStats()`
4. Add display row in `renderStats()`
5. Add label in play log renderer

---

## File Inventory

| File | Purpose | Push to GitHub? |
|------|---------|----------------|
| `index.html` | Full application | ✅ Yes |
| `manifest.json` | PWA manifest | ✅ Yes |
| `service-worker.js` | Offline/PWA | ✅ Yes |
| `icon-192.png` | App icon | ✅ Yes |
| `icon-512.png` | App icon | ✅ Yes |
| `README.md` | Documentation | ✅ Yes |
