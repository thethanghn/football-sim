# Football Sim

A browser-based football match simulator inspired by Championship Manager 01/02 and 03/04. Single-page web app — open `football-sim.html` and play.

```
football-sim/
├── football-sim.html   # markup + all CSS; entry point
├── football-sim.js     # simulator, UI, FSM, events, rendering glue
├── game-flow.js        # MatchFlow — pitch animation / ball movement
└── zone-strength.js    # ZoneStrength — pure zone-rating calculators
```

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
- **Long Shots (team)** (`rarely | mixed | often`) — ×0.35 / ×1.0 / ×1.6 on long-shot trigger probability.
- **Tackling** (`hard | normal | easy`) — currently UI only; effect can be wired up later.
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

**Step 3**: Apply fatigue multiplier per player — `sf + (1 - sf) × det × 0.5` where `sf = max(0.5, stamina/100)` and `det = determination/100`.

**Step 4**: Bucket-average and multiply by formation bonus.

### 3.2 Model B — 5×3 spatial grid (`gridStrengths(...)`)

Debug overlay only. 5 vertical bands × 3 lateral lanes = 15 cells.

For each onfield player:
1. Look up their current home position from `matchFlow._home`.
2. For every cell, compute `d = distance(home, cell_center)`.
3. If `d < RADIUS` (38 pitch units), contribute `overall × stamina_factor × SCALE × w` where `w = 1 - d/RADIUS` (linear falloff) and `SCALE = 0.6`.

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

### 4.2 Individual instructions (CM 01/02-style)

6 fields per player, defaults vary by position; see `Team.defaultInstructions(position)`.

| Instruction | Values | Effect |
|---|---|---|
| Forward Runs | rarely / mixed / often | Biases scorer/chance-taker selection; `_pushMult` ×0.65–×1.25 in game-flow |
| Run With Ball | rarely / mixed / often | Biases dribble-event selection; team-wide trigger rate |
| Long Shots | rarely / mixed / often | Long-shot shooter weighting; team-wide trigger rate |
| Through Balls | rarely / mixed / often | Through-ball passer weighting; final-ball through-ball share |
| Hold Up Ball | yes / no | When yes on a forward → progression phase +1 tick |
| Free Role | yes / no | Drift amplitudes ×1.4–1.7 in `_driftTick` / `_wingerTick`; wider X clamp |

Plus an 8-direction movement arrow (see §5).

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

---

## 5. Tactics (team-level)

`this.tactics` carries five team-wide knobs, configured via the bottom-right Tactics panel in the management screen.

| Tactic | Values | Default |
|---|---|---|
| Mentality | ultra-def / defensive / normal / attacking / gung-ho | normal |
| Pressing | always / standard / stand-off / own-half | standard |
| Tackling | hard / normal / easy | normal *(UI only — no engine effect yet)* |
| Passing | direct / mixed / short | mixed |
| Long Shots | rarely / mixed / often | mixed |

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

Three-column-ish layout: `grid-template-columns: 1fr 2fr` outer, right side stacked `2fr 1fr`.

```
┌──────────────┬────────────────────────────┐
│  👥 PLAYERS  │  ⚽ STARTING XI            │
│  (bench)     │  (formation pitch — 2/3)   │
│   1fr        ├────────────────────────────┤
│              │  ⚙ Formation / Tactics /   │
│              │    Sub Controls (1/3)      │
└──────────────┴────────────────────────────┘
```

### 7.1 Substitution

- **Drag-and-drop** is the only path:
  - Bench → starting-XI slot = swap (routes through `confirmSubstitution`, respects sub quota in-match).
  - XI → bench player = swap.
  - XI → XI = swap formation positions.
  - XI → empty pitch area = sets `player.customPos` (clamped ±15 from formation default).
- **Click** on a starter opens a 3-option floating context menu:
  - 📋 View Details → opens the detail overlay (radar + attribute bars) over the formation pitch.
  - ⚙ Set Instructions → opens a floating popover anchored to the player slot with 6 instruction rows.
  - 🎯 Set Movement Arrow → opens a smaller popover with the 3×3 compass picker.
- **Click** on a bench player → opens the detail overlay directly.

Only one popover/overlay visible at a time; outside-click and Escape close.

### 7.2 Player list

Each item shows: avatar (with GK-kit override) · name · `Nationality · Position · #ShirtNumber` · stamina bar · big overall badge (coloured by tier).

### 7.3 Formation pitch

Each slot is `<button>` with an avatar, name, position + overall, stamina bar, and `draggable="true"`. Movement arrows are drawn as a single SVG overlay (`fm-arrows-overlay`) above the field lines.

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

---

## 9. Speed Modes

Three options via buttons next to Pause in the match-screen controls:

| Speed | Event tick | Timer tick |
|---|---|---|
| ⚡ Fast (default) | 500 ms | 1000 ms |
| ▶️ Normal | 1000 ms | 2000 ms |
| 🐢 Slow | 1500 ms | 3000 ms |

Changing speed mid-match takes effect on the next tick — implemented via recursive `setTimeout` that reads the current speed each iteration.

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

`FootballRules.MAX_SUBS = 3`. Quotas tracked per team via `recordSub` / `canSubstitute` / `subsRemaining`. Drag-substitute calls `confirmSubstitution` which checks the quota (skipping in pre-match).

### 11.3 Cards & sendings-off

`cardEvent` issues a yellow or red (15 % chance for direct red). Second yellow becomes red. Sent-off players are removed from `onField` via `removeFromField`. GK send-off triggers `handleGKSendOff` which substitutes a bench GK if available, otherwise moves an outfield player into goal.

### 11.4 Special player

`Team.generatePlayers` ensures one slot in the "You" team is always **Nguyễn Thế Chí Vỹ** — a hand-crafted ST with overall 93, high finishing/composure/off-the-ball/heading, and guaranteed in the starting XI's forward section.

### 11.5 Reset / new match

`reset()` clears all match state, regenerates the player team and a new CPU team, and returns to the management screen for pre-match setup. Match speed and instructions persist where appropriate; tactics reset to defaults.

---

## 12. Inspirations & sources

CM 01/02 / CM 03/04 idioms used here:

- 19-attribute CM 03/04 player model + per-position weighted overalls.
- 8-direction movement arrows from CM 01/02's right-click-drag tactics screen.
- Six individual instructions (Forward Runs / Run With Ball / Long Shots / Through Balls / Hold Up Ball / Free Role).
- Text-event commentary (CM 01/02 had no 2D engine).
- Streaker / pitch invader / weather / floodlight flavour events.

References:

- [Championship Manager 01/02 — Wikipedia](https://en.wikipedia.org/wiki/Championship_Manager:_Season_01/02)
- [General Guide to Championship Manager 3 — Season 01/02 (Marc Vaughan)](https://www.angelfire.com/sports/ctfc/0102genguide.pdf)
- [Forward Arrows & Forward Runs — Champman 0102 Forums](https://champman0102.net/viewtopic.php?t=4051)
- [Team & Player Instructions 4 All Tactics — Champman 0102 Forums](https://www.champman0102.net/viewtopic.php?t=2629)
- [Why people are still playing CM 01/02 — TechRadar](https://www.techradar.com/features/championship-manager-season-01-02)
