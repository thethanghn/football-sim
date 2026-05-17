# Screen Navigation Map

Snapshot of how the app's screens / views are wired today (current code, before
the upcoming Match Management restructure). Useful as a reference when
discussing the restructure.

---

## 1. Top-level screens

Each is a `<div class="screen">` loaded as a partial from `screens/<name>.html`
by `screens/screen-loader.js` into a `[data-screen]` placeholder at boot. Only
one is `active` at a time. Switched via `FootballSimulator.switchScreen(id)`
which toggles `.active` + `display:none/block/flex`.

| ID                 | Loaded from                          | Purpose (today)                                       |
| ------------------ | ------------------------------------ | ----------------------------------------------------- |
| `formationScreen`  | `screens/formationScreen.html`       | Legacy formation picker. **No longer reachable** in the normal flow — kept loaded but unused. |
| `matchScreen`      | `screens/matchScreen.html`           | Live pitch + match HUD + score.                       |
| `managementScreen` | `screens/managementScreen.html`      | Squad list + formation pitch + tactic buttons. **Currently empty** — its inner DOM is relocated into the Clubhouse `Tactics & XI` view at boot. |
| `resultScreen`     | `screens/resultScreen.html`          | Post-match summary + "Back to Clubhouse" button.      |
| `clubhouseScreen`  | `screens/clubhouseScreen.html`       | Career home base. Left rail menu + right-pane views. |

Always-on chrome (outside any single screen):

- **Top menu bar** (`#topMenuBar`) — `⚽ Football Match Simulator` · manager+club · in-game date · `☰` hamburger.
- **Hamburger dropdown** (`#topMenuDropdown`) — mute toggle, speed buttons, debug toggle, Match History, Reset Career.
- **Fast-forward overlay** (`#ffOverlay`) — gold progress bar that animates the in-game date forward before a match.
- **Onboarding overlay** (`#onboardingOverlay`) — shown on first boot or after Reset Career; 4 wizard steps.

---

## 2. Boot path

`bootstrapSimulator()` → `new FootballSimulator()` → wires every listener →
checks `GameStorage.loadManager()`:

- **No saved manager** → `_showOnboarding()` → onboarding overlay (step 1).
- **Saved manager exists** → `_refreshManagerLabel()` + `_refreshDateLabel()` → `setTimeout(_enterClubhouse, 0)`.

`_enterClubhouse()` populates the club header / stadium / banner and calls
`switchScreen('clubhouseScreen')`. The default Clubhouse view is `stadium`.

---

## 3. Onboarding wizard (4 steps, single overlay)

```
Step 1: Manager name        ─ Continue →
Step 2: Pick SEA nation     ─ ← Back · Continue →
Step 3: Pick home city      ─ ← Back · Generate league →
Step 4: League preview      ─ ← Back · Enter Clubhouse →
```

`Enter Clubhouse →` fires `_completeOnboarding()` which:

1. Persists manager + league + fixtures + in-game date (= kickoff − 7 days)
2. Adopts the chosen club's crest / kit / squad (`regenerateRoster`)
3. Hides the overlay
4. Refreshes top-bar labels
5. Calls `_enterClubhouse()` → `clubhouseScreen` (stadium view)

---

## 4. Clubhouse left-menu actions

All routed through `_handleClubhouseAction(action)`. Each push goes through
`_navigateTo(label, applyFn)` which adds a step to the in-app nav stack
(driven by the back/forward pill — currently at the bottom of `.clubhouse-menu`
after the recent move).

| Menu item              | `action`    | Effect                                                                   |
| ---------------------- | ----------- | ------------------------------------------------------------------------ |
| 🏟️ Stadium             | `home`      | `_setClubhouseView('stadium')` — default illustration view               |
| 👥 Squad               | `squad`     | `_setClubhouseView('squad')` → `_renderClubhouseSquad()` (portrait list) |
| 📋 Tactics & XI        | `tactics`   | `_openTacticsView()` → switch to clubhouse + `tactics` view + `renderManagementPanel()`. **Reads relocated `managementScreen` DOM inside `#chTacticsHost`.** |
| 🏆 League Table        | `league`    | `_setClubhouseView('league')` → `_renderClubhouseLeague()`               |
| 📅 Fixtures            | `fixtures`  | `_setClubhouseView('fixtures')` → `_renderClubhouseFixtures()`           |
| ⚽ Play Next Match     | `play`      | `_setClubhouseView('next-match')` → `_renderNextMatchView()` (matchup card + Play button) |
| 📜 Match History       | `history`   | Opens history modal (separate from clubhouse views)                       |
| 🪑 Manager's Office    | `office`    | Placeholder `alert()` (coming soon)                                       |

`_setClubhouseView(name)` toggles `.active` on `.ch-view[data-view=...]`
elements inside `.clubhouse-stage`. **All sub-views live inside the same
`clubhouseScreen`** — they are NOT separate screens.

---

## 5. Match flow (today)

```
Next Match view  ─►  fast-forward overlay  ─►  startMatch()
                                                   │
                                                   ▼
                                         matchScreen (live pitch)
                                          │           │
                                          │ Manage    │ match ends
                                          ▼           ▼
                                   openManagement   resultScreen
                                          │              │
                                          │              ▼
                                  switch back to    ⬅ Back to Clubhouse
                                   matchScreen       (reset + _enterClubhouse)
```

### Pre-match → match
- **`Play Match` button (Next Match view)** → `_fastForwardToMatch(ctx)`
  - Stashes `this._pendingFixture = ctx`
  - Animates the gold progress bar (~1.2s) ticking the in-game date
  - Persists the new `currentDate` to storage
  - Calls `startMatch()` directly (formation screen is **bypassed**)
- **`startMatch()`** creates the CPU team from `_pendingFixture` (or random if missing), sets up its squad, and `switchScreen('matchScreen')`.

### In-match
- **`Manage` button (`#manageBtn` on `matchScreen`)** → `openManagement()`:
  - Pauses match (`isPaused = true`)
  - Calls `_navigateTo('📋 Tactics & XI', () => _openTacticsView())`
  - `_openTacticsView()` switches to **clubhouseScreen** + `tactics` view
  - ⚠️ **This is the leak the next restructure needs to fix** — the Manage button currently dumps the user back into the Clubhouse pane mid-match.

- **`Close` button (`#closeManageBtn`)** → `closeManagement()`:
  - Unpauses, hides popovers, `switchScreen('matchScreen')`.

### Match end
- `MatchFlow` calls back to the simulator → `switchScreen('resultScreen')`.
- **`⬅ Back to Clubhouse`** (`#backToClubhouseBtn`) → `reset()` + `_enterClubhouse()`.

---

## 6. Navigation stack (back / forward)

Implemented in `_initNavStack` / `_navigateTo` / `_navBack` / `_navForward`.

- Each `_navigateTo(label, applyFn)` pushes `{label, apply}` and runs `apply()`.
- The pill (`#navBackBtn` / `#navLabel` / `#navFwdBtn`) was the floating bottom
  bar — **just moved into the bottom of `.clubhouse-menu`**.
- Forward history is truncated whenever a new entry is pushed.
- Used for: every clubhouse menu click, `_openTacticsView` (also called by `openManagement`), and the Clubhouse home.
- **Not used for**: `switchScreen` calls in match / result flows (those are raw screen swaps).

---

## 7. Always-available controls

- **Top bar manager label** — refreshed by `_refreshManagerLabel()` after manager changes.
- **Top bar date chip** — refreshed by `_refreshDateLabel()` after onboarding completion / boot / fast-forward.
- **Hamburger dropdown**:
  - 🔊 Mute toggle (audio settings)
  - 🎚 Speed (slow / normal / fast — affects MatchFlow tick rate)
  - 🐛 Debug zone grid
  - 📜 Match History modal
  - ♻️ Reset Career → wipes storage → `_showOnboarding()`

---

## 8. Known issues this map exposes

These are the things the next restructure should address.

1. **Mid-match Manage button leaks into Clubhouse.** `openManagement()` calls `_openTacticsView()` which `switchScreen('clubhouseScreen')` — so during a live match the user can click Squad / League / Fixtures and abandon the in-progress match. There is no "in-match" guard.

2. **`managementScreen` is dead DOM.** Its inner content is relocated to `#chTacticsHost` at boot. The standalone screen is unreachable. This works while the tactics editor is embedded in the Clubhouse, but blocks making it an independent match-time screen.

3. **No "kick off" affordance.** After fast-forward the match starts immediately. There's no chance to review XI / tweak tactics for this specific fixture before kickoff.

4. **`formationScreen` is orphaned.** Loaded but never reached in the normal flow. Should either be removed or repurposed.

5. **The nav stack mixes views and screens.** `_navigateTo` pushes both clubhouse sub-views and screen-level actions (e.g. `_openTacticsView`). Back/forward semantics may surprise the user if we add a separate `managementScreen` route.

---

## 9. Proposal under discussion (next change)

Promote `managementScreen` to a true independent screen, shared by three callers:

| Entry point                          | Mode             | Primary action button       |
| ------------------------------------ | ---------------- | --------------------------- |
| Clubhouse → `Tactics & XI`           | `tactics`        | `← Back to Clubhouse`       |
| Play Next Match → fast-forward end   | `kickoff`        | `▶ Kick Off Match`          |
| `matchScreen` → `Manage`             | `inMatch`        | `← Resume Match` (no Clubhouse access) |

- Stop relocating content; `managementScreen` keeps its own DOM.
- Add `this._inMatch` guard. While true, `switchScreen('clubhouseScreen')` and `_handleClubhouseAction` are no-ops (or only allowed for specific safe items if we want any).
- `_inMatch` flips on at Kick Off, off when the match concludes (result screen) or on Reset Career.
