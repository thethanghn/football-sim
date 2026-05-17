# Football Sim

A browser-based football match simulator inspired by Championship Manager 01/02 and 03/04. Single-page web app — open `football-sim.html` and play.

```
football-sim/
├── football-sim.html        # markup + all CSS; entry point
├── football-sim.js          # simulator, UI, FSM, events, rendering glue
├── game-flow.js             # MatchFlow — pitch animation / ball movement
├── zone-strength.js         # ZoneStrength — pure zone-rating calculators
├── league-generator.js      # LeagueGenerator — table, fixtures, simulateMatch (persistent rosters)
├── mgmt-components.js       # MgmtComponents — composable Match-Mgmt / Tactic-view panels
├── storage.js               # GameStorage — localStorage wrapper (manager, league, fixtures, …)
├── random.js                # Random — seeded LCG + pick / range / chance / shuffle / gaussian
├── audio.js                 # AudioFx — synthesised match audio
├── dramatic.js              # DramaticOverlay — cinematic SVG scenes
├── dramatic-scenes/         # Per-event scene helpers (goal, penalty, freekick, …)
├── screens/                 # Loaded partials: clubhouse, match, management, result, formation
└── football-sim-deploy/     # Vercel deploy mirror (built from the above)
```

---

## Site map — screens · panels · views

The whole app lives in `football-sim.html`. Five top-level **screens** are loaded as partials from `screens/<name>.html` into `[data-screen]` placeholders at boot; only one carries `.active` at a time. The Clubhouse hosts its own **sub-views** inside its right pane, and the Match-Management editor is a reusable **panel** composed from `mgmt-components.js` and mounted into two different hosts.

```
App
├── Always-on chrome
│   ├── #topMenuBar ─────── brand · manager+club · in-game date · ☰
│   │   └── #topMenuDropdown  ⏸ Pause · 🔊 Sound · ⚡ Speed · 🐛 Debug · 📜 History · 🔄 Reset
│   ├── #onboardingOverlay ─ 4-step wizard (name → nation → city → league preview)
│   ├── #ffOverlay ──────── fast-forward gold progress bar before a match
│   ├── #playerContextMenu  🔄 Substitute · 📋 Details · ⚙ Instructions · 🎯 Arrow
│   ├── #playerInstructionsMenu ─ per-player instruction popover
│   ├── #playerArrowMenu ── 3×3 compass arrow picker
│   └── #historyModal ───── last-50-match list + per-match detail
│
├── Screens (one .active at a time)
│   │
│   ├── #clubhouseScreen ─── post-onboarding home base
│   │   ├── Desktop:  .clubhouse-menu (left rail)
│   │   │             ├── Menu items: Stadium · Squad · Tactics & XI · League · Fixtures · Play · History · Office
│   │   │             └── Back / label / Forward nav pill
│   │   ├── Mobile:   .ch-mobile-footer (bottom bar — see §15.1)
│   │   │             ├── ☰ Menu  →  .ch-mobile-menu-sheet (slide-up sheet of items)
│   │   │             └── Back / label / Forward nav pill (mirrors desktop via _refreshNavButtons)
│   │   └── .clubhouse-stage (right pane — one .ch-view.active)
│   │       ├── .ch-view-stadium        ─ kit-colour stadium SVG + "Home of <Club>" banner
│   │       ├── .ch-view-table (league) ─ standings + 🥇 Top Scorers + 🎯 Top Assists  (§13.1)
│   │       ├── .ch-view-table (fixtures) ─ rounds grouped past / today / upcoming
│   │       ├── .ch-view-tactic         ─ .tactic-host  →  mgmt-components Tactic layout (§7)
│   │       │                            (squad-depth · next-match chip · pitch · tactic panel · presets)
│   │       ├── .ch-view-next-match     ─ matchup card + meta + ▶ Play (triggers #ffOverlay)
│   │       ├── .ch-view-table (today)  ─ post-match round results
│   │       └── .ch-view-squad          ─ portrait list + .ch-squad-detail slide-in
│   │
│   ├── #managementScreen ── independent Match-Management editor (kickoff + mid-match)
│   │   ├── Header (#managementCrest + #managementTitle)
│   │   └── .match-mgmt-host  →  mgmt-components Match-Mgmt layout (§7)
│   │       ├── .mm-score-chip       ─ live  <Club> N – N <Opp> · 73' · Subs 3/5
│   │       └── Main grid (1fr 2fr)
│   │           ├── .squad-section (bench list)
│   │           └── .mgmt-right-stack (2fr 1fr)
│   │               ├── .squad-section (formation pitch + .player-detail-overlay)
│   │               └── .mgmt-settings-pane
│   │                   ├── .pending-subs-panel    (slot, currently empty)
│   │                   ├── .formation-selector    (7 formation buttons)
│   │                   ├── .tactic-panel          (Mentality / Pressing / …)
│   │                   └── .primary-action-host   (▶ Kick Off / ← Resume Match)
│   │
│   ├── #matchScreen ─────── live 90' simulation
│   │   ├── .match-header (crests · timer · score)
│   │   ├── .pitch-container
│   │   │   ├── #pitchSVG          ─ Phaser/SVG PitchRenderer (§8)
│   │   │   ├── #dramaticOverlay   ─ cinematic SVG scenes (goal · penalty · red card · …)
│   │   │   └── #celebrationScreen ─ confetti + stadium scene on a goal
│   │   ├── .match-content / #eventsLog (stats panel + commentary)
│   │   └── #manageBtn  →  switches to #managementScreen (in-match mode)
│   │
│   ├── #resultScreen ────── post-match summary
│   │   ├── Final score + #goalScorerList
│   │   ├── #finalStats (per-team box-score)
│   │   ├── .player-stats-table (per-player ratings, both sides)
│   │   └── ← Back to Clubhouse  (calls _enterClubhouse)
│   │
│   └── #formationScreen ── legacy, unreachable in the current flow
│
└── (Match flow: Next Match → #ffOverlay → #managementScreen [kickoff] → #matchScreen → #resultScreen → Clubhouse)
```

`mgmt-components.js` exports the same `.mgmt-panel` builders to two hosts — `.match-mgmt-host` (Match-Mgmt layout, primary action visible) and `.tactic-host` (Tactic layout, no primary action). `_getActiveMgmtScope()` returns whichever panel is currently visible so renderers operate on the right DOM tree.

---

## 1. Match Engine

A text-driven engine that ticks every event interval and resolves football events via a four-phase possession FSM.

### 1.1 Tick loop

`runMatch()` runs two recursive `setTimeout` chains:

- **Event tick** (default 500 ms) — calls `generateEvent()` once. This drives the FSM.
- **Timer tick** (default 1000 ms) — drains `timeRemaining` from 60 s; 1 real-time second ≈ 1.5 match minutes.

Both intervals are multiplied by a speed factor (Slow ×3 / Normal ×2 / Fast ×1).

### 1.2 Possession FSM (in `generateEvent` and `_do*`)

```
            ┌────────────────────────────────┐
            ▼                                │
       ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ _begin   │ ─► │ _do      │ ─► │ _do      │ ─► │ _do      │
       │Possession│    │ Buildup  │    │Progression│   │ Danger   │
       └──────────┘    └──────────┘    └──────────┘    └──────────┘
            ▲                ▲                ▲                │
            └────────────────┴────────────────┴── turnover ────┘
```

| Phase | Purpose | Ends on |
|---|---|---|
| `_beginPossession` | Midfield battle — picks the attacking team via weighted coin flip on midfield zone ratings | Always advances |
| `_doBuildup` | Patient buildup in the attacking team's own half (1–3 ticks based on Passing tactic) | Pass-into-progression OR turnover OR throw-in/goal-kick |
| `_doProgression` | Pushing toward the attacking third (0–3 ticks based on Mentality + Passing + holdUpBall) | Final-ball into danger OR tackle/intercept/corner OR long-shot OR dribble |
| `_doDanger` | Shot situation, always terminal | Goal / chance / miss / save / bar / corner / penalty / wonder-goal |

Each phase also tracks the **attack zone** (`_attackBand`, `_attackLane`) and advances it by 1 band per `_advanceZone(1)` call.

### 1.3 Inputs to the FSM

- **3-band zone ratings** (`ZoneStrength.bandRatings`) — `attack`, `midfield`, `defense` per team. Drives midfield-battle outcome, intercept/turnover probability, and shot quality.
- **Mentality** (`ultra-def | defensive | normal | attacking | gung-ho`) — ±16 to midfield, ±28 % to attack/defense in danger.
- **Pressing** (`always | standard | stand-off | own-half`) — ±40 % to turnover/intercept chances.
- **Passing** (`direct | mixed | short`) — buildup length, attack multiplier (×0.92–×1.10), through-ball share.
- **Tackling** (`hard | normal | easy`) — ±8 % on tackle success; "hard" raises foul rate.
- **Marking** (`zonal | man`) — man-marking gives ×1.10 turnover bonus in buildup.
- **Time Wasting** (`never | mixed | often`) — when leading, multiplies throw-in trigger by 1.0/1.5/2.5.
- **Counter Attack** (`no | yes`) — `yes` adds 35 % to the chance of skipping buildup and breaking straight into progression on a turnover win.
- **Momentum** (0–100, running stat) — nudges midfield/attack/defense by ±0.15–0.2 × (momentum − 50).
- **Stamina × determination** — per-player fatigue multiplier (never below 0.5).
- **Formation bonus** — multiplies each zone rating by a per-formation factor (see §6).

---

## 2. Events Catalog (CM 01/02-inspired)

23 event types, all routed through `_emitMatchEvent(type, payload)` so they carry zone coordinates.

### 2.1 Possession-flow events

| Event | Fires when | Renderer behaviour |
|---|---|---|
| `possession` | New possession won | Ball animates to player nearest zone |
| `passEvent` | Every buildup / progression / final tick | Passer & receiver picked nearest zone |
| `tackleEvent` | Turnover during buildup/progression/danger | Both players pulled to zone, ball cleared toward team's safe area |
| `throwInEvent` | 6 % of buildup ticks | Ball animates to specific touchline coords |
| `goalKickEvent` | 10 % of buildup first ticks | GK launches it long |
| `cornerEvent` | Defensive clearance in progression/danger | Ball to corner flag, 8 defenders + 5 attackers in box (see §11.2) |
| `offsideTrapEvent` / `goalDisallowedEvent` | Defensive trap or post-goal review | Flag raised on the attack's lane |

### 2.2 Shot events (`_doDanger`)

| Event | Rate | Notes |
|---|---|---|
| `chanceEvent` | Common at high attackScore | Shot from zone, ball flies toward goal |
| `missedChanceEvent` | Common | Wide of goal, side biased by attacker's y |
| `saveEvent` | Common | Ball animates from zone to GK |
| `barEvent` | Less common | Hits crossbar, rebounds toward midfield |
| `goalEvent` | Score-dependent | GK save roll; on success → celebration |
| `penaltyEvent` | ~4 % | Taker = composed forward; full GK save roll |
| `freeKickEvent` | ~5 % | Direct free kick from fixed (x, y) |
| `longShotEvent` | 6–30 % per progression tick | Shooter weighted by individual `longShots` + team Long Shots tactic |
| `headerEvent` | ~5 % danger / on turnovers | Attacking or defensive headed duel |
| `throughBallEvent` | 18–55 % of final balls | Passer weighted by `throughBalls` instruction |
| `dribbleEvent` | 8–22 % per progression tick | Dribbler weighted by `runWithBall` instruction |
| `oneOnOneEvent` | ~6 % when attackScore > 0.5 | Striker vs GK |
| `ownGoalEvent` | ~1.2 % | Defender turns in |
| `spectacularEvent` | ~1.5 % at high attackScore | Volley / bicycle / overhead / diving header |
| `goalmouthScrambleEvent` | ~4 % | Six-yard-box chaos |

### 2.3 Possession-neutral / flavour

`cardEvent`, `injuryEvent`, `substitutionEvent` — interrupt without resetting phase.

Flavour events (each ~0.5–2 % per top-of-tick): `streakerEvent`, `pitchInvaderEvent`, `floodlightEvent`, `weatherEvent` (rain/fog/wind/snow), `ballBoyEvent`, `crowdChantEvent`, `managerArguesEvent`. Pure text colour — no ball movement.

### 2.4 Event payloads

Every ball-or-player event includes `{ x, y, band, lane }` derived from the simulator's current `_attackBand` / `_attackLane`. Set-piece events (corner, throw-in, free-kick) keep their fixed coords and `_emitMatchEvent` skips auto-annotation when `x` & `y` are pre-set.

---

## 3. Zone Strength (in `zone-strength.js`)

Two independent models, both implemented as `ZoneStrength` static methods.

### 3.1 Model A — 3-band ratings (`bandRatings(team, formation)`)

What the engine actually reads. Returns `{ attack, midfield, defense }`.

**Step 1**: Bin each onfield player into one bucket by position label.

| Bucket | Positions |
|---|---|
| Attack | ST, CF, LW, RW, CAM |
| Midfield | CM, CDM, LM, RM |
| Defense (outfield) | CB, LB, RB, LWB, RWB |
| Defense (GK) | GK — uses GK-specific weights |

**Step 2**: Compute per-player rating with bucket-specific weights.

| Bucket | Attribute weights |
|---|---|
| Attack | finishing 0.30, off-the-ball 0.25, composure 0.20, dribbling 0.15, heading 0.10 |
| Midfield | passing 0.25, vision 0.20, creativity 0.20, tackling 0.15, stamina 0.10, anticipation 0.10 |
| Defense (outfield) | marking 0.30, tackling 0.25, heading 0.20, anticipation 0.15, strength 0.10 |
| Defense (GK) | reflexes 0.35, handling 0.30, positioning 0.20, composure 0.15 |

**Step 3**: Apply `ZoneStrength.perPlayerMult(player)` — `fatigueMult × moraleMult × positionMult` (see §4.7). Stacks stamina drain, match-day form, and out-of-position penalties into one number.

**Step 4**: Bucket-average and multiply by formation bonus.

### 3.2 Model B — 5×3 spatial grid (`gridStrengths(...)`)

Debug overlay only. 5 vertical bands × 3 lateral lanes = 15 cells.

For each onfield player:
1. Look up their current home position from `matchFlow._home`.
2. For every cell, compute `d = distance(home, cell_center)`.
3. If `d < RADIUS` (38 pitch units), contribute `overall × perPlayerMult × SCALE × w` where `w = 1 - d/RADIUS` (linear falloff), `SCALE = 0.6`, and `perPlayerMult` is the same fatigue × morale × position-penalty composite as §3.1 Step 3.

Cell's reported strength = **sum** (not average) of all weighted contributions — so more players or higher-quality players near a zone = higher number.

### 3.3 Formation bonuses

| Formation | Attack | Midfield | Defense |
|---|---|---|---|
| 4-4-2 | 1.00 | 1.00 | 1.00 |
| 4-3-3 | 1.10 | 0.95 | 0.95 |
| 4-5-1 | 0.92 | **1.18** | 1.00 |
| 5-3-2 | 0.90 | 1.00 | 1.10 |
| 5-4-1 | 0.82 | 1.05 | **1.20** |
| 3-5-2 | 1.05 | 1.12 | 0.88 |
| 3-4-3 | 1.12 | 1.05 | 0.88 |

---

## 4. Player Model

### 4.1 Attributes (CM 03/04-style)

Stored on every player at generation time. Position-specific value ranges in `Team.generateAttributes(position, seed)`.

| Group | Attributes |
|---|---|
| Physical | pace, stamina, strength |
| Mental | composure, determination, anticipation, vision, creativity, off-the-ball, positioning |
| Technical | finishing, passing, dribbling, crossing, heading, tackling, marking |
| Goalkeeping | reflexes, handling |
| **Hidden** | influence (55–99), luck (0–99) — never shown in UI |

Plus position-weighted **overall** rating, shown in the player list / pitch slots / detail card using a tiered colour scale:

| Overall | Colour | Label |
|---|---|---|
| 90+ | 🟣 purple | Legendary |
| 80–89 | 🟢 dark green | Great |
| 70–79 | 🟩 light green | Good |
| 60–69 | ⚪ grey | Average |
| 50–59 | 🟡 yellow | Poor |
| <50 | 🔴 red | Terrible |

### 4.1.1 Bio: age + height

Every player carries an **age** and a **height** (cm), sampled per-position with `Random.gaussianInt`:

| Field | Source | Range |
|---|---|---|
| `age` | Normal(25, 4), clamped | 17–38 |
| `height` | Position-aware Normal — GK/CB/ST taller (188 / 186 / 184 cm means), wingers shorter (175 cm) | 160–205 |

Shown in the detail card as `Age 26 · 184 cm`.

### 4.1.2 Multiple positions

Every player has both a **natural** position (where they're best) and 1–2 **secondary** positions they're competent at. Generated at player creation by `Team.randomSecondaries(position)` from a `POSITION_SECONDARY_POOL` table (e.g. a natural ST can have CF and/or CAM as secondaries; CBs draw from CDM/LB/RB; LWs from LM/CF/ST).

Position is displayed as **`Natural/Sec1/Sec2`** everywhere — bench list, formation slot, detail card. Single-position players (rare, mainly GKs) show just the natural.

When a player is asked to play a slot that doesn't match their natural, an **out-of-position multiplier** kicks in (`ZoneStrength.positionMult`):

| Played role vs. competence | Multiplier |
|---|---|
| Natural | **1.00** |
| One of their secondary positions | **0.88** |
| Same family but not in their secondary list | **0.72** |
| Different family entirely | **0.50** |

Position families: `GK`, `centre-back` (CB, CDM), `fullback` (LB/RB/LWB/RWB), `central-mid` (CM, CAM), `wide` (LM/RM/LW/RW), `striker` (ST/CF).

#### When does the playing position differ from the natural?

`Team.SLOT_POSITIONS[formation]` maps each starting-XI slot index to an expected role. `Team.assignSlotPositions(formation)` is called after **every** roster change so the played `position` field matches the slot:

- Initial `setupSquad` (pre-match XI).
- `confirmSubstitution` (sub).
- `_handleDragDrop` XI↔XI swap.
- `changeCpuFormation` (CPU manager AI changes shape mid-match).
- `injuryEvent` substitution.
- `handleGKSendOff` already sets `position = 'GK'` for the emergency keeper — they pick up the 0.50× cross-family penalty automatically.

Players going back to the bench have their `position` reverted to their `naturalPosition`.

When a slot mismatch leaves a player playing somewhere not in `{natural, secondaries}`, the formation slot renders the position label in **orange with an asterisk** (e.g. `ST/CF/CAM*`), with a tooltip explaining the mismatch. The detail card shows `⚠ playing LB` in orange next to age/height.

### 4.2 Individual instructions (CM 03/04-style)

8 fields per player + an 8-direction movement arrow. Defaults vary by position; see `Team.defaultInstructions(position)`. Some only appear in the popover for relevant positions (Cross Ball for wide players, Hold Up Ball for forwards, Tight Marking for defenders/mids).

| Instruction | Values | Effect |
|---|---|---|
| Forward Runs | rarely / mixed / often | Biases scorer/chance-taker selection; `_pushMult` ×0.65–×1.25 in game-flow |
| Run With Ball | rarely / mixed / often | Biases dribble-event selection; team-wide trigger rate |
| Long Shots | rarely / mixed / often | Long-shot shooter weighting; raises team's per-progression long-shot trigger probability |
| Through Balls | rarely / mixed / often | Through-ball passer weighting; final-ball through-ball share |
| Cross Ball | rarely / mixed / often | Wide players — raises the chance the final ball is a cross resolving as a headed chance |
| Hold Up Ball | yes / no | Forwards — when yes → progression phase +1 tick |
| Tight Marking | yes / no | Defenders / mids — +6 % to their tackle success when they're the tackler |
| Free Role | yes / no | Drift amplitudes ×1.4–1.7 in `_driftTick` / `_wingerTick`; wider X clamp |
| **Mentality** | default / ultra-def / defensive / normal / attacking / gung-ho | Per-player override of team Mentality. `default` follows team. `_pushMult` ×0.65–×1.30 in game-flow — an "attacking" CB ventures forward more, a "defensive" striker tracks back. |
| **Tackling** | default / hard / normal / easy | Per-player override of team Tackling. Resolved by `_playerTactic(defender, 'tackling')` in `tackleEvent` — affects this defender's tackle success ±8 % and foul rate. |
| **Passing** | default / direct / mixed / short | Per-player override of team Passing. Resolved by `_playerTactic(passer, 'passing')` in `passEvent` — affects this passer's accuracy and the pass description. |

Plus an 8-direction movement arrow (see §4.3) and a PES-style match-day morale arrow (see §4.6).

### 4.3 Movement arrows

Eight team-relative directions: forward / back / left / right / forward-left / forward-right / back-left / back-right (plus null).

- **UI**: 3×3 compass picker in the per-player floating popover (centre cell = clear).
- **Visual**: long dashed gold SVG line on the formation pitch, drawn from the outer edge of the player card in the arrow direction to a target point (LEN = 20% on cardinals, 14% on diagonals).
- **Engine** (`_targetPos` in game-flow.js): the player's effective home position shifts toward the arrow target. Baseline 55 % of arrow offset even at rest (the player's *default* position becomes the arrow target); 85–110 % during attack. `LEN = 22` pitch units forward/back/left/right, `DIAG = 16` on diagonals. So a CM with a forward arrow plays like an AM.

### 4.4 Stamina & fatigue

`updateStats` ticks every event interval and drains stamina:

```
baseRate = position === 'GK' ? 0.08 : 0.28
drain    = baseRate × (1 - determination/100 × 0.35)
stamina  = max(10, stamina - drain)
```

Visualised as a thin coloured bar in three places:
- Above each player's circle on the match pitch (16×2.5 px SVG inside the player's `<g>` so it pans with the player).
- Inside each bench player item.
- Inside each formation-pitch slot.

Colour scale: `<30` red, `<60` yellow, `≥60` green.

### 4.5 Goalkeeper kit

GK gets a contrasting kit derived from the team's outfield colour in HSL:

1. RGB → HSL.
2. Hue rotated 180° (complementary).
3. If the result lands in [90°, 150°] (pitch green band), shift +60°.
4. Saturation clamped to ≥ 0.85.
5. Lightness inverted: `l < 0.55 → 0.72`, else `→ 0.28`.

So red teams get light cyan GKs, blue teams get light yellow, etc. Applied at every render point (pitch circle, formation slot, bench list, detail card).

### 4.6 Match-day morale (PES-style condition arrows)

Every player rolls a match-day condition tier at generation time (`Team.randomMorale`) on a bell curve biased toward `normal`:

```
top      10 %     ↑  red / pink   ×1.10
good     22 %     ↗  orange       ×1.05
normal   36 %     →  yellow       ×1.00
poor     22 %     ↘  blue         ×0.95
terrible 10 %     ↓  purple       ×0.88
```

The arrow glyph appears:
- inline in the bench player item (small, next to the position line);
- as a **circular floating badge at the top-LEFT of each formation-pitch slot**, tinted to the morale tier — mirrors the overall-rating badge at top-right (see §7.3).

Engine effect: `ZoneStrength.moraleMult(player)` multiplies the per-player rating contribution. A team collectively in poor form drops 5–12 % across all three zone bands. Visible in the debug zone grid as lower numbers per cell.

Nguyễn Thế Chí Vỹ is hard-coded `top` — the talisman is always up for it.

### 4.7 Combined per-player multiplier

`ZoneStrength.perPlayerMult(player)` composes the three modifiers used everywhere ratings are computed:

```
perPlayerMult = fatigueMult × moraleMult × positionMult
```

So a tired, low-morale, out-of-position player can land around `0.7 × 0.88 × 0.5 ≈ 0.31×` — the kind of catastrophic drop that shows up immediately on the debug zone-grid numbers.

---

## 5. Tactics (team-level)

`this.tactics` carries seven team-wide knobs, configured via the Tactics panel in the management screen. These match the CM 03/04 canonical team tactical instructions (Long Shots is **not** team-level in CM 03/04 — it lives on each player; see §4.2).

**Mentality / Tackling / Passing also exist as per-player overrides** (see §4.2 — same names, plus a `default` option that defers to the team setting). The engine reads them via `_playerTactic(player, key)` which returns the player's value when set, otherwise the team's.

| Tactic | Values | Default | Effect |
|---|---|---|---|
| Mentality | ultra-def / defensive / normal / attacking / gung-ho | normal | ±16 to midfield, ±28 % to attack/defense in danger; raises buildup-skip chance |
| Pressing (Closing Down) | always / standard / stand-off / own-half | standard | ±40 % to turnover/intercept chances |
| Tackling | hard / normal / easy | normal | ±8 % to tackle success; "hard" raises foul rate |
| Passing | direct / mixed / short | mixed | Shorter buildup with "direct"; longer with "short"; attack multiplier ×0.92–×1.10 |
| Marking | zonal / man | zonal | Man-marking ×1.10 turnover bonus in buildup |
| Time Wasting | never / mixed / often | mixed | When leading, multiplies throw-in trigger 1.0× / 1.5× / 2.5× |
| Counter Attack | no / yes | no | When yes, +35 % chance to skip buildup → straight to progression on a possession win |

---

## 6. Formations & Squad

Seven supported formations: **4-4-2**, **4-3-3**, **4-5-1**, **5-3-2**, **5-4-1**, **3-5-2**, **3-4-3**. Each has:

- A row-count tuple (e.g. 4-4-2 → `[1, 4, 4, 2]`) used by `setupSquad` to auto-pick the best XI.
- A formation bonus to attack/midfield/defense ratings (§3.3).
- A layout in `renderFormationPitch.layouts[formation]` — 11 (cx%, cy%) coordinates for placing slots on the management-panel pitch view.
- A separate `pitchRenderer.calculatePositions(formationCounts, teamId)` for the actual match pitch (team-relative coordinates).

### 6.1 CPU manager AI (`_evaluateCpuFormation`)

Sampled at 15% of every event tick; 12-minute cooldown between changes; ignored before minute 15 or after 88.

| Match state | Likely target |
|---|---|
| Trailing 2+, ≤35 min left | 3-4-3 or 4-3-3 — chase |
| Trailing 1, ≤25 min left | 4-3-3 / 3-5-2 / 3-4-3 — push for equaliser |
| Leading 2+, ≤30 min left | 5-4-1 / 5-3-2 — park bus |
| Leading 1, ≤18 min left | 4-5-1 / 5-3-2 — protect lead |
| Tied after 60', losing midfield by 8+ | 4-5-1 / 3-5-2 |
| Tied after 60', attack < player.defense − 10 | 4-3-3 / 3-5-2 |

On a change: updates `this.cpuFormation`, recomputes CPU home positions via `pitchRenderer.calculatePositions`, writes them into `matchFlow._home` (CPU IDs 100–110 only), animates CPU players to new spots via `matchFlow._reshape('cpu', 900)`, and logs an event:

```
📋 CPU MANAGER (62'): 4-4-2 → 4-3-3 (pushing for the equaliser)
```

### 6.2 Squad selection (`Team.setupSquad`)

For each formation, `setupSquad`:
1. Picks the best GK by overall.
2. Fills defender, midfielder, forward slots with the highest-overall players that match each row.
3. Sorts within each row left→right by a position-weight map (LB=1, CB=4, RB=7, etc.) so the visual layout shows wide players on the wings.
4. Remaining players become the bench.

---

## 7. Management Panel UI

The XI/tactics editor is a **reusable component** (`mgmt-components.js`) composed into two layouts that share the same inner panel:

- **Match Management screen** (`#managementScreen`) — independent fullscreen used at kickoff and mid-match. Composes: bench list · live score chip · formation pitch · formation selector · tactic panel · primary action button (Kick Off / Resume Match).
- **Clubhouse → Tactics & XI view** (`.ch-view-tactic`) — embedded planning view. Composes: squad-depth list · next-match preview chip · formation pitch · formation selector · tactic panel · preset slot. No primary action — the clubhouse menu handles navigation.

Both mount the same `.mgmt-panel` builders, so renderers operate on a scoped DOM tree via `_getActiveMgmtScope()`. The variant class on the panel root (`.mgmt-panel-match` / `.mgmt-panel-tactic`) keeps per-screen CSS or scope-aware logic possible.

Outer grid: `grid-template-columns: 1fr 2fr`, right side stacked `2fr 1fr`.

```
┌──────────────┬────────────────────────────┐
│  👥 PLAYERS  │  ⚽ STARTING XI            │
│  (bench)     │  (formation pitch — 2/3)   │
│   1fr        ├────────────────────────────┤
│              │  ⚙ Formation / Tactics /   │
│              │    Primary action (1/3)    │
└──────────────┴────────────────────────────┘
```

### 7.1 Substitution

Two interchangeable paths — drag works on desktop, tap on touch devices:

- **Drag-and-drop** (desktop):
  - Bench → starting-XI slot = swap (routes through `confirmSubstitution`, respects sub quota in-match).
  - XI → bench player = swap.
  - XI → XI = swap formation positions.
  - XI → empty pitch area = sets `player.customPos` (clamped ±15 from formation default).
- **Tap → context menu** (touch + desktop):
  - Tap a starter or bench player → floating menu with **🔄 Substitute** at top, plus details/instructions/arrow for starters.
  - `🔄 Substitute` marks the player via `selectPlayer`. Pick one from XI and one from the bench (either order) and `selectPlayer` auto-confirms the swap.

Mobile-only because HTML5 drag-and-drop doesn't fire on touch devices; on desktop both paths are available.

Other tap actions on a starter's context menu: **📋 View Details** (radar + attribute bars), **⚙ Set Instructions** (8-row popover), **🎯 Set Movement Arrow** (3×3 compass). Bench players hide Instructions + Arrow (only meaningful on the pitch). Only one popover/overlay visible at a time; outside-click and Escape close.

### 7.2 Player list

Each item shows: avatar (with GK-kit override) · name · `Nationality · Position · #ShirtNumber` · stamina bar · big overall badge (coloured by tier).

### 7.3 Formation pitch

Each slot is `<button draggable="true">` containing avatar, last name, and stamina bar. Two **floating circular badges** sit on the card chrome:

- **Top-right** — overall rating, background tinted to the OVR tier colour (purple ≥ 90 / dark green ≥ 80 / light green ≥ 70 / grey ≥ 60 / yellow ≥ 50 / red <50). White text + drop shadow for legibility on every tier.
- **Top-left** — match-day morale arrow, background tinted to the morale tier (red ↑ / orange ↗ / yellow → / blue ↘ / purple ↓). Same chrome as the OVR badge.

The natural (primary) position is rendered inside `.pos-primary` so it stands out from the secondaries — e.g. **ST**/CF/CAM. Out-of-position slots wrap the whole label in orange with an asterisk. Movement arrows are drawn as a single SVG overlay (`fm-arrows-overlay`) above the field lines.

### 7.4 Live score chip (Match Mgmt only)

Pinned above the main grid during a live match: `<Club> 2 – 1 <Opponent> · 73' · Subs 3/5`. Hidden before kickoff. Renders from `renderManagementPanel()` and ticks via `updateUI()`, so the chip stays in sync with the match clock + score without polling.

### 7.5 Next-match preview chip (Tactic view only)

Pinned above the main grid in the clubhouse Tactic view: `vs <Opponent> (H/A) · <Date>`. Reads from `_findNextUserFixture()`. Hidden when no fixtures remain.

---

## 8. Match Pitch Rendering (`PitchRenderer`)

SVG-based. Each player is a `<g>` containing:

- coloured circle (team kit / GK kit)
- shirt number text
- name pill below
- stamina bar above (`updateStamina(id, stamina)`)

All children share the group's `transform: translate(...)` so they pan together when the animation engine moves the player.

`MatchFlow` (game-flow.js) drives the movement:

- `_home` Map: id → formation home position (set by `init`, updated by sub / formation change / customPos drag).
- `_push[team]`: running attacking-pressure stat (−10 to +15). Bumped by `_applyPush` on key events. Read by `_targetPos` to offset home position toward opponent's goal.
- `_targetPos(id)` is the single source of truth — applies formation home + `_push × _pushMult(id)` + arrow offset + free-role multipliers.
- Tick functions (`_driftTick`, `_wingerTick`, `_gkTick`) move players around their target.
- Event handlers (`_evGoal`, `_evChance`, `_evPass`, `_evCorner`, etc.) animate the ball and players in response to simulator events.

### 8.1 Per-player instructions in game-flow

`matchFlow.setPlayerInfo(map)` gives MatchFlow the id → player map after every substitution. From this it reads `player.instructions`:

- `forwardRuns`: `_pushMult` ×1.25 if often, ×0.65 if rarely.
- `freeRole`: `_driftTick` amplitudes ×1.7, `_wingerTick` ×1.4, X-clamp loosened.
- `arrow`: applied in `_targetPos` (see §4.3).

### 8.2 Wingers

`_wingerTick` runs every 950 ms. For players matching `_isWinger(id)` (wide AND forward):

- Attacking phase (`push > 2`): big lateral runs (yRun ±19), forward sprint (xRun +4 to +13), 40 % chance to cut inside, 55 % chance to make a far-post run when ball is on the opposite flank.
- Retreating (`push < -2`): tuck back and narrow.

X-clamp expands during attacks so wingers can reach the box.

### 8.3 Corner kicks

`_evCorner` plants 8 defenders + GK in the box (near post, far post, 6-yard mid, 3× penalty-spot band, 2× edge-of-box) against 5 attackers. Animations complete in ≤660 ms before the cross is delivered at t=750ms.

### 8.4 Kick-off mode

A real kick-off plays out at match start **and** after every goal. `MatchFlow._kickoffMode` is a boolean gate:

1. Flips on (`_doKickoff(kickoffTeam)`).
2. Every player on **both teams** animates to their own half — `x ≤ 48` for the player team, `x ≥ 52` for CPU. Lateral lane (y) is preserved.
3. Two forwards from the kicking team go to centre-circle slots at `(48, 48)` & `(48, 52)` (player) or `(52, 48)` & `(52, 52)` (CPU).
4. Ball animates to `(50, 50)`.
5. All three movement ticks (`_driftTick`, `_wingerTick`, `_gkTick`) early-return — players are pinned in place.
6. The simulator's `generateEvent` also skips when `matchFlow._kickoffMode` is true — no shots / passes / tackles fire while players are walking to their halves.
7. After **1500 ms**, `_releaseKickoff` flips the gate off and the two takers exchange a short pass to start the action.

After a goal, `_evGoal` waits 5.2 s (the celebration) then calls `_doKickoff(team === 'player' ? 'cpu' : 'player')` so the conceding team kicks off, as in real football.

### 8.5 Free kicks

Free kicks resolve in two layers:

- `freeKickEvent(team)` (simulator) — picks a specialist taker (highest `finishing + crossing`), logs `📐 Dangerous free kick`, calls `_emitMatchEvent('freekick')` to trigger the visual, then rolls for **goal / wall / save / over**.
- `_evFreekick({ team, x, y })` (matchFlow) — animates: 4-man wall in front of ball, GK behind the wall toward the near post, taker stands over it, remaining attackers spread into the box, kick is taken at t=1.2 s, FWDs burst into the box.

Triggers:

| When | How |
|---|---|
| Foul in the attacker's attacking third (band ≥ 3 for player, ≤ 1 for CPU) | `tackleEvent` foul branch calls `freeKickEvent(attTeam)` → full simulator-side resolution |
| Foul elsewhere (own half / midfield) | `tackleEvent` emits only the visual; ball returns to attacking team via the animation |
| Out-of-the-blue dangerous free kick | `_doDanger` rolls 5 % per shot decision |

---

## 9. Speed Modes

Three options. **Pause / Speed / Mute all live in the top hamburger dropdown** — the match view itself only keeps the **Manage Team** button so the HUD stays clean.

| Speed | Event tick | Timer tick |
|---|---|---|
| ⚡ Fast (default) | 500 ms | 1000 ms |
| ▶️ Normal | 1000 ms | 2000 ms |
| 🐢 Slow | 1500 ms | 3000 ms |

Cycle via the **⚡ Match speed** header item (Fast → Normal → Slow → Fast). The dropdown also exposes **⏸ Pause match** (disabled outside a match), **🔊 Sound**, **🐛 Debug overlay**, **📜 Match history**, and **🔄 Reset career**. Changing speed mid-match takes effect on the next tick — implemented via recursive `setTimeout` that reads the current speed each iteration.

---

## 10. Debug Mode

Triple-click the match clock to toggle. When on:

- Clock border turns gold.
- A 5×3 zone-strength grid overlays the pitch.
- Each cell shows two numbers — top in your jersey colour (player team strength here), bottom in CPU jersey colour.
- Cells outside any player's 38-unit influence radius show "—".
- Refreshes every event tick.

Numbers use the spatial sum model (§3.2): more players or higher-quality players near a cell = larger number.

Coordinates are stamped `B1·L1` … `B5·L3` in tiny grey at the top-left of each cell.

---

## 11. Misc

### 11.1 Match clock & duration

60 real-time seconds = 90 match minutes. `rules.getMatchMinute(timeRemaining)` converts.

Match ends at `timeRemaining === 0` → `endMatch()` switches to the result screen.

### 11.2 Substitution rules

`FootballRules.MAX_SUBS = 5`. Quotas tracked per team via `recordSub` / `canSubstitute` / `subsRemaining`. Substitutions (drag OR tap → 🔄 context-menu action) all route through `confirmSubstitution`, which checks the quota (skipping in pre-match) and then calls `assignSlotPositions(formation)` so the incoming player adopts the slot's expected role. The outgoing player's `position` is reset to their `naturalPosition` as they leave the field.

### 11.3 Cards & sendings-off

`cardEvent` issues a yellow or red (15 % chance for direct red). Second yellow becomes red. Sent-off players are removed from `onField` via `removeFromField`. GK send-off triggers `handleGKSendOff` which substitutes a bench GK if available, otherwise moves an outfield player into goal (`emergency.position = 'GK'`). That outfielder is now in a different position family, so `ZoneStrength.positionMult` automatically applies the 0.50× penalty — emergency keepers play visibly worse.

### 11.4 Special player

`Team.generatePlayers` ensures one slot in the "You" team is always **Nguyễn Thế Chí Vỹ** — a hand-crafted ST with overall 93, high finishing/composure/off-the-ball/heading, and guaranteed in the starting XI's forward section.

### 11.5 Reset / new match

`reset()` clears all match state, regenerates the player team and a new CPU team, and returns to the management screen for pre-match setup. Match speed and instructions persist where appropriate; tactics reset to defaults.

---

## 12. Random utilities (in `random.js`)

A small standalone `Random` class — the seeded LCG `(a=9301, c=49297, m=233280)` used to live inline in `AvatarGenerator.seededRandom` and `CrestGenerator._rng`; now consolidated here and called as a shim from both for byte-identical seed output.

| Method | Purpose |
|---|---|
| `Random.seeded(seed)` | Stateful LCG. Returns a function that yields floats in [0, 1) |
| `Random.pick(arr, rng?)` | Random element; `rng` defaults to `Math.random` |
| `Random.range(lo, hi, rng?)` | Integer in `[lo, hi]` inclusive |
| `Random.chance(p, rng?)` | Boolean — true with probability `p` |
| `Random.pickWeighted(items, weightOf, rng?)` | Weighted pick |
| `Random.shuffle(arr, rng?)` | Fisher–Yates copy-shuffle |
| `Random.gaussian(mean, std, rng?)` | Box–Muller sample |
| `Random.gaussianInt(mean, std, lo, hi, rng?)` | Clamped + rounded gaussian — used by `Team.randomAge` / `Team.randomHeight` |

The `Math.random()` calls scattered through the engine (event probabilities, formation picks, lane shifts) are intentionally untouched so each match plays out differently. Helpers are available there too if a seeded match replay is ever wanted.

---

## 13. Clubhouse, league table & leaderboards

The **Clubhouse** screen (`#clubhouseScreen`) is the post-onboarding home base. Left rail (or mobile bottom-sheet, see §15) routes between sub-views; the right pane (`.clubhouse-stage`) hosts whichever view is active. All sub-views live inside the same screen — they're toggled via `.ch-view.active`.

| Menu item | View | Key data |
|---|---|---|
| 🏟️ Stadium | stadium illustration | kit-colour stadium SVG with `Home of <Club>` banner |
| 👥 Squad | portrait list + detail overlay | `playerTeam.players` with stamina, position, overall |
| 📋 Tactics & XI | embedded mgmt panel (Tactic variant) | XI editor + next-match chip (§7.5) |
| 🏆 League Table | standings + leaderboards (§13.1) | `LeagueGenerator.sortTable(league)` + `_aggregateTopScorersAndAssists()` |
| 📅 Fixtures | round-by-round fixture list | grouped by round; past dimmed, today highlighted, future bright |
| ⚽ Play Next Match | matchup card + Play button | reads `_findNextUserFixture()`; Play fires the fast-forward |
| 📜 Match History | modal (separate from clubhouse views) | last 50 matches from `GameStorage.loadHistory()` |

### 13.1 Top scorers / Top assists

Two tables render below the league standings: **🥇 Top Scorers** and **🎯 Top Assists**. Each shows `# / Player / Club / G or A` for the top 10.

Source: `_aggregateTopScorersAndAssists()` walks every league club's persistent `players[]` roster (see §13.2), summing each player's career `goals` / `assists`. For the user's club it pulls from `GameStorage.loadPlayerTeam()` instead, since that's where the user's roster edits + match increments land. Fresh saves (no rosters yet) fall back to per-match snapshot aggregation from match history.

User's club rows are highlighted gold (same as the standings).

### 13.2 League-wide attribution (persistent CPU rosters)

Each league club gets a **persistent player roster** so scorers/assists accumulate across the whole season instead of only in matches the user played.

- `LeagueGenerator.ensureRoster(club, nation)` — lazily generates ~18 position-balanced players via `Team.createPlayer`, names from the league's nation, quality biased by `club.budget`. No-op when a roster already exists. Called at onboarding for every non-user club, and as a safety net in `simulateRound` for older saves.
- `LeagueGenerator.simulateMatch(home, away)` — replaces the old `simulateScore` in `simulateRound`. Generates a Poisson-sampled score (same as before) **plus** picks a scorer per goal (weighted by finishing/off-the-ball, biased toward FWD/AM positions) and a 62 %-chance assister (weighted by passing/creativity/vision, biased toward CAM/CM/W). Each pick increments the player's `goals` / `assists`.
- **User's match path** — `_buildCpuOpponent()` passes the league club's persistent `players[]` into the `Team` constructor. The same player objects accumulate stats during the live match, then `_mergeMatchStatsIntoCareer()` folds the per-match `stats.goalsScored` / `stats.assistsGiven` into career `goals` / `assists` before `endMatch` saves the league.

Result: a single coherent leaderboard whether goals came from a user-played match or a CPU-vs-CPU simulated round.

### 13.3 Fixtures double round-robin + auto-heal

`LeagueGenerator.generateFixtures(clubs)` produces a full double round-robin: `2(n-1)` rounds, each pair meets twice (home + away mirrored in the second leg). For 10 clubs → 18 rounds, 90 matches, each team gets 9 H + 9 A.

Older saves that pre-date this produced only the first leg. `GameStorage.loadFixtures()` invokes `LeagueGenerator.backfillSecondLegIfMissing(rounds, league)` on every read — when the saved fixture list is exactly `n-1` rounds, it appends a mirror second leg with continued weekly Sat/Sun dates, then writes the upgraded list back so subsequent loads short-circuit.

---

## 14. Game logic notes

### 14.1 Shot accounting

All paths that produce a shot at goal increment `stats.playerShots` / `stats.cpuShots`:

| Outcome | Counts as shot? | Counts as on-target? |
|---|---|---|
| Goal (open play, header, long shot, penalty, free kick, spectacular, one-on-one) | ✓ | ✓ |
| Saved by keeper (open-play danger, headed shot, etc.) | ✓ | ✓ |
| Wide / over the bar | ✓ | ✗ |
| Hit the crossbar | ✓ | ✗ |
| Tackle / interception / cleared corner (no shot taken) | ✗ | ✗ |

Saves and headed-shot outcomes (saved or over) were previously missing from the team shot tally — fixed so the box-score row reflects all actual shot attempts.

---

## 15. Mobile UX

A `@media (max-width: 640px)` block reshapes a few screens for touch:

### 15.1 Clubhouse bottom app footer

The desktop left rail is hidden on mobile. A fixed **bottom footer** appears at the bottom of `#clubhouseScreen` with two halves:

- **Left** — `☰ Menu` button. Tapping slides up a bottom-sheet of menu items (Stadium / Squad / Tactics & XI / League / Fixtures / Play / History / Office). Sheet items mirror the desktop rail (same `data-clubhouse-action`), so the same handler wires both. Tap an item or the dark backdrop to close.
- **Right** — Back / current-label / Forward nav pill, mirroring the desktop nav stack via duplicate IDs that `_refreshNavButtons()` keeps in sync.

`.clubhouse-stage` gets bottom padding `56px + env(safe-area-inset-bottom)` so long views clear the footer.

### 15.2 Match Management mobile fixes

- `#managementScreen` becomes `height: auto; min-height: 100dvh; overflow: visible` so the document scrolls naturally to the **▶ Kick Off Match** / **← Resume Match** button at the bottom.
- The formation pitch drops its `50vh` cap and uses `aspect-ratio: 3 / 4` with `min-height: 360px`. `overflow: visible` so player slots near the goal lines aren't clipped.
- The tactic panel stays visible (with compact row/label sizing).
- Substitution is via the tap-menu (§7.1) since HTML5 drag-and-drop doesn't fire on touch.

### 15.3 Top bar + safe area

The fixed top bar (`#topMenuBar`) sits at `top: env(safe-area-inset-top)` so on a notched iPhone it ducks below the notch rather than under it. Body padding-top is `calc(44px + env(safe-area-inset-top)) !important` so no later shorthand `padding: 0` rule can collapse the top clearance.

### 15.4 Player card polish

- **Floating OVR badge** — top-right of every formation-pitch slot, big enough to read at a glance during a live match (see §7.3).
- **Floating morale badge** — top-left, mirroring the OVR badge layout (see §4.6).
- **Thicker stamina bar** — 7 px (was 3 px) with bolder border + inset shadow.
- **Primary position highlighted** — natural position wrapped in `.pos-primary` (gold/bold) inside the comma-separated position label.

### 15.5 Vietnamese names

The Vietnam entry in the player-name pool has a `middle` array and `middleProb: 0.75`. `Team.createPlayer` slots a middle name between the family name and given name per local convention — producing names like **Nguyễn Văn Minh** or **Đặng Ngọc Long** instead of just **Nguyễn Minh**.

---

## 16. Inspirations & sources

Idioms / mechanics borrowed from real football management games:

| Source | Mechanic |
|---|---|
| **CM 03/04** | 19-attribute player model + per-position weighted overall ratings |
| **CM 01/02** | 8-direction movement arrows from the right-click-drag tactics screen |
| **CM 03/04** | Eight per-player instructions (Forward Runs / Run With Ball / Long Shots / Through Balls / Cross Ball / Hold Up Ball / Tight Marking / Free Role) — plus separate team-level Marking / Time Wasting / Counter Attack |
| **CM 01/02** | Text-event commentary (CM 01/02 had no 2D engine) |
| **CM 01/02** | Streaker / pitch invader / weather / floodlight flavour events |
| **CM / FM** | Multi-position system with natural + secondary positions + out-of-position penalty |
| **PES** (classic era) | 5-tier condition arrows (red ↑ top → purple ↓ terrible) and the matching colour palette |

References:

- [Championship Manager 01/02 — Wikipedia](https://en.wikipedia.org/wiki/Championship_Manager:_Season_01/02)
- [General Guide to Championship Manager 3 — Season 01/02 (Marc Vaughan)](https://www.angelfire.com/sports/ctfc/0102genguide.pdf)
- [Forward Arrows & Forward Runs — Champman 0102 Forums](https://champman0102.net/viewtopic.php?t=4051)
- [Team & Player Instructions 4 All Tactics — Champman 0102 Forums](https://www.champman0102.net/viewtopic.php?t=2629)
- [Why people are still playing CM 01/02 — TechRadar](https://www.techradar.com/features/championship-manager-season-01-02)
- [PES Condition arrows — Pro Evolution Soccer Wiki / Neoseeker](https://pes.neoseeker.com/wiki/Condition_arrows)
- [PES Form Explained — PES Mastery](https://pesmastery.com/pes-form/)
