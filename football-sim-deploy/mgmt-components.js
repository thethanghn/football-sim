/**
 * MgmtComponents — composable building blocks for the Match Management screen
 * and the Clubhouse Tactic view.
 *
 * Two layouts compose these blocks differently:
 *   - buildMatchMgmtLayout(): in-game (kickoff / live match). Includes the
 *     bench list (with sub quota), live score chip, primary action button
 *     ("▶ Kick Off" / "← Resume Match"), and a pending-subs slot.
 *   - buildTacticLayout(): clubhouse-embedded planning view. Includes the
 *     squad-depth list (positional breakdown), a next-match preview chip,
 *     and preset slots — but no primary action (clubhouse menu handles nav).
 *
 * Each block uses CLASS selectors only so multiple copies can coexist in the
 * DOM. Renderers in football-sim.js scope queries to the active panel:
 *     scope.querySelector('.bench-list')
 *
 * Each layout is wrapped in a .mgmt-panel root with a variant class
 * (.mgmt-panel-match or .mgmt-panel-tactic). Existing code that queries
 * .mgmt-panel continues to work; the variant class enables future CSS or
 * scope-aware rendering.
 */
window.MgmtComponents = {

    // ─── Section builders ────────────────────────────────────────────────
    // Each returns an HTML string for one composable section.

    // Bench / full squad list (Match Management variant — shows sub quota
    // context via parent title).
    buildBenchList() {
        return `
        <div class="mgmt-section squad-section" data-section="bench">
            <div class="squad-title">👥 PLAYERS</div>
            <div class="squad-list bench-list"></div>
        </div>`;
    },

    // Squad depth (Tactic variant). Phase 1: shares .bench-list class so the
    // existing player-list renderer in football-sim.js still fills it. Phase 3
    // will swap to a positional breakdown (GK/DEF/MID/FWD) by reading
    // data-section="squad-depth" and using a Tactic-specific renderer.
    buildSquadDepth() {
        return `
        <div class="mgmt-section squad-section" data-section="squad-depth">
            <div class="squad-title">📊 SQUAD DEPTH</div>
            <div class="squad-list squad-depth-list bench-list"></div>
        </div>`;
    },

    // 11-slot formation pitch + the player-detail overlay that covers it.
    buildFormationPitch() {
        return `
        <div class="mgmt-section squad-section" data-section="pitch" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; position: relative;">
            <div class="squad-title" style="border-radius: 0; flex-shrink: 0;">⚽ STARTING XI</div>
            <div class="formation-pitch fm-pitch"></div>

            <div class="player-detail-overlay" style="display: none;">
                <button class="player-detail-close-x player-detail-close-btn" type="button" aria-label="Close">×</button>
                <div class="player-detail-overlay-content"></div>
            </div>
        </div>`;
    },

    // Formation pick buttons (442 / 433 / …).
    buildFormationSelector() {
        return `
        <div class="mgmt-section formation-selector" data-section="formation-selector" style="flex-shrink: 0;">
            <div style="color: #FFD700; font-weight: bold; font-size: 11px; text-align: center; margin-bottom: 7px; text-transform: uppercase; letter-spacing: 1px;">⚙ Formation</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                <button class="formation-btn" data-formation="442" style="padding: 7px 4px; font-size: 12px;">4-4-2<div class="formation-desc">Balanced</div></button>
                <button class="formation-btn" data-formation="433" style="padding: 7px 4px; font-size: 12px;">4-3-3<div class="formation-desc">Offensive</div></button>
                <button class="formation-btn" data-formation="451" style="padding: 7px 4px; font-size: 12px;">4-5-1<div class="formation-desc">Midfield</div></button>
                <button class="formation-btn" data-formation="532" style="padding: 7px 4px; font-size: 12px;">5-3-2<div class="formation-desc">Defensive</div></button>
                <button class="formation-btn" data-formation="541" style="padding: 7px 4px; font-size: 12px;">5-4-1<div class="formation-desc">Ultra Def</div></button>
                <button class="formation-btn" data-formation="352" style="padding: 7px 4px; font-size: 12px;">3-5-2<div class="formation-desc">Mid Power</div></button>
                <button class="formation-btn" data-formation="343" style="padding: 7px 4px; font-size: 12px;">3-4-3<div class="formation-desc">Attack</div></button>
            </div>
        </div>`;
    },

    // CM 03/04-style tactic rows (mentality / pressing / tackling / …).
    buildTacticPanel() {
        return `
        <div class="mgmt-section instruction-panel tactic-panel" data-section="tactic-panel" style="flex-shrink: 0;">
            <div class="instruction-title">⚔ Tactics</div>

            <div class="tactic-row">
                <span class="tactic-label">Mentality</span>
                <div class="tactic-options">
                    <button class="tactic-btn" data-tactic="mentality" data-value="ultra-def">U.Def</button>
                    <button class="tactic-btn" data-tactic="mentality" data-value="defensive">Def</button>
                    <button class="tactic-btn active" data-tactic="mentality" data-value="normal">Normal</button>
                    <button class="tactic-btn" data-tactic="mentality" data-value="attacking">Attack</button>
                    <button class="tactic-btn" data-tactic="mentality" data-value="gung-ho">GungHo</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">Pressing</span>
                <div class="tactic-options">
                    <button class="tactic-btn" data-tactic="closingDown" data-value="always">Always</button>
                    <button class="tactic-btn active" data-tactic="closingDown" data-value="standard">Standard</button>
                    <button class="tactic-btn" data-tactic="closingDown" data-value="stand-off">StandOff</button>
                    <button class="tactic-btn" data-tactic="closingDown" data-value="own-half">Own Half</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">Tackling</span>
                <div class="tactic-options">
                    <button class="tactic-btn" data-tactic="tackling" data-value="hard">Hard</button>
                    <button class="tactic-btn active" data-tactic="tackling" data-value="normal">Normal</button>
                    <button class="tactic-btn" data-tactic="tackling" data-value="easy">Easy</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">Passing</span>
                <div class="tactic-options">
                    <button class="tactic-btn" data-tactic="passing" data-value="direct">Direct</button>
                    <button class="tactic-btn active" data-tactic="passing" data-value="mixed">Mixed</button>
                    <button class="tactic-btn" data-tactic="passing" data-value="short">Short</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">Marking</span>
                <div class="tactic-options">
                    <button class="tactic-btn active" data-tactic="marking" data-value="zonal">Zonal</button>
                    <button class="tactic-btn" data-tactic="marking" data-value="man">Man</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">Time Wasting</span>
                <div class="tactic-options">
                    <button class="tactic-btn" data-tactic="timeWasting" data-value="never">Never</button>
                    <button class="tactic-btn active" data-tactic="timeWasting" data-value="mixed">Mixed</button>
                    <button class="tactic-btn" data-tactic="timeWasting" data-value="often">Often</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">Counter Attack</span>
                <div class="tactic-options">
                    <button class="tactic-btn active" data-tactic="counterAttack" data-value="no">No</button>
                    <button class="tactic-btn" data-tactic="counterAttack" data-value="yes">Yes</button>
                </div>
            </div>
        </div>`;
    },

    // Primary action button slot. Caller fills via setPrimaryAction().
    buildPrimaryAction() {
        return `
        <div class="mgmt-section primary-action-host" data-section="primary-action" style="flex-shrink: 0;">
            <button class="btn-primary primary-action-btn" style="width: 100%; padding: 14px; font-size: 15px; letter-spacing: 2px; text-transform: uppercase; display: none;"></button>
        </div>`;
    },

    // Live score + minute chip (Match Management only).
    buildScoreChip() {
        return `
        <div class="mgmt-section mm-score-chip" data-section="score-chip" style="display:none; align-items:center; justify-content:center; gap:10px; padding:6px 10px; margin-bottom:10px; flex-shrink:0;">
            <span class="mm-score-club"></span>
            <span class="mm-score-value">0 – 0</span>
            <span class="mm-score-opponent"></span>
            <span class="mm-score-minute" style="margin-left:12px; color:#FFD700; font-weight:bold;"></span>
            <span class="mm-score-subs" style="margin-left:12px;"></span>
        </div>`;
    },

    // Pending substitutions panel (Match Management only). Filled later
    // by Phase 2 work; mounted now so the slot exists.
    buildPendingSubsPanel() {
        return `
        <div class="mgmt-section pending-subs-panel" data-section="pending-subs" style="display:none; flex-shrink:0;">
            <div class="instruction-title">⏳ Pending Substitutions</div>
            <div class="pending-subs-list"></div>
            <div class="pending-subs-actions" style="display:none; gap:8px; margin-top:8px;">
                <button class="btn-secondary pending-subs-cancel" type="button" style="flex:1;">Cancel</button>
                <button class="btn-primary pending-subs-confirm" type="button" style="flex:1;">Confirm</button>
            </div>
        </div>`;
    },

    // Next-match preview chip (Tactic view only).
    buildNextMatchChip() {
        return `
        <div class="mgmt-section tactic-next-match-chip" data-section="next-match-chip" style="display:none; align-items:center; gap:10px; padding:8px 12px; margin-bottom:10px; flex-shrink:0; background:rgba(0,0,0,0.25); border:1px solid #FFD700; border-radius:6px;">
            <span style="font-size:11px; color:#FFD700; text-transform:uppercase; letter-spacing:1px;">Next Match</span>
            <span class="next-match-opponent" style="font-weight:bold;"></span>
            <span class="next-match-date" style="margin-left:auto; color:#86EFAC; font-size:11px;"></span>
        </div>`;
    },

    // Auto-substitution policies (Tactic view only). Three rows for Injury /
    // Stamina / Performance. Buttons reuse the .tactic-btn style but carry
    // a data-autosub attribute so the delegated handler in football-sim.js
    // routes them to _setAutoSub instead of setTactic.
    buildAutoSubPanel() {
        return `
        <div class="mgmt-section instruction-panel auto-sub-panel" data-section="auto-sub-panel" style="flex-shrink: 0;">
            <div class="instruction-title">🤖 Auto Substitutions</div>

            <div class="tactic-row">
                <span class="tactic-label">On Injury</span>
                <div class="tactic-options">
                    <button class="tactic-btn"        data-autosub="onInjury" data-value="off">Off</button>
                    <button class="tactic-btn active" data-autosub="onInjury" data-value="on">On</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">On Stamina</span>
                <div class="tactic-options">
                    <button class="tactic-btn active" data-autosub="onStamina" data-value="off">Off</button>
                    <button class="tactic-btn"        data-autosub="onStamina" data-value="low">Cond&lt;60</button>
                    <button class="tactic-btn"        data-autosub="onStamina" data-value="critical">Cond&lt;40</button>
                </div>
            </div>

            <div class="tactic-row">
                <span class="tactic-label">On Performance</span>
                <div class="tactic-options">
                    <button class="tactic-btn active" data-autosub="onPerformance" data-value="off">Off</button>
                    <button class="tactic-btn"        data-autosub="onPerformance" data-value="low">Rating&lt;6.0</button>
                    <button class="tactic-btn"        data-autosub="onPerformance" data-value="critical">Rating&lt;5.0</button>
                </div>
            </div>
        </div>`;
    },

    // Tactic preset slots (Tactic view only). Filled later by Phase 3 work;
    // mounted now so the slot exists.
    buildPresetSlots() {
        return `
        <div class="mgmt-section tactic-presets" data-section="presets" style="display:none; flex-shrink:0;">
            <div style="color:#FFD700; font-weight:bold; font-size:11px; text-align:center; margin-bottom:7px; text-transform:uppercase; letter-spacing:1px;">📁 Presets</div>
            <div class="tactic-presets-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:5px;"></div>
        </div>`;
    },

    // ─── Layout composers ─────────────────────────────────────────────────

    // Match Management layout — used at kick-off and during a live match.
    // Differs from Tactic by: bench list (with sub quota context), score
    // chip, pending-subs slot, primary action.
    buildMatchMgmtLayout() {
        return `
        <div class="mgmt-panel mgmt-panel-match" data-scope="match-mgmt" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">

            <div class="mobile-player-detail"></div>

            ${this.buildScoreChip()}

            <div class="mgmt-main-grid" style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; flex: 1; overflow: hidden; min-height: 0;">

                ${this.buildBenchList()}

                <div class="mgmt-right-stack" style="display: grid; grid-template-rows: 2fr 1fr; gap: 15px; overflow: hidden; min-height: 0;">

                    ${this.buildFormationPitch()}

                    <div class="mgmt-settings-pane" style="display: flex; flex-direction: column; gap: 12px; overflow-y: auto; min-height: 0; padding-right: 4px;">
                        ${this.buildPendingSubsPanel()}
                        ${this.buildFormationSelector()}
                        ${this.buildTacticPanel()}
                        ${this.buildPrimaryAction()}
                    </div>
                </div>
            </div>
        </div>`;
    },

    // Tactic layout — embedded in the Clubhouse right pane. Differs from
    // Match Management by: squad depth list, next-match chip, preset slots,
    // no primary action (clubhouse menu handles navigation).
    buildTacticLayout() {
        return `
        <div class="mgmt-panel mgmt-panel-tactic" data-scope="tactic" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">

            <div class="mobile-player-detail"></div>

            ${this.buildNextMatchChip()}

            <div class="mgmt-main-grid" style="display: grid; grid-template-columns: 1fr 2fr; gap: 15px; flex: 1; overflow: hidden; min-height: 0;">

                ${this.buildSquadDepth()}

                <div class="mgmt-right-stack" style="display: grid; grid-template-rows: 2fr 1fr; gap: 15px; overflow: hidden; min-height: 0;">

                    ${this.buildFormationPitch()}

                    <div class="mgmt-settings-pane" style="display: flex; flex-direction: column; gap: 12px; overflow-y: auto; min-height: 0; padding-right: 4px;">
                        ${this.buildFormationSelector()}
                        ${this.buildTacticPanel()}
                        ${this.buildAutoSubPanel()}
                        ${this.buildPresetSlots()}
                    </div>
                </div>
            </div>
        </div>`;
    },

    // ─── Mounters ─────────────────────────────────────────────────────────

    // Inject the Match Management layout into `host`. Returns the panel root.
    mountMatchMgmt(host) {
        if (!host) return null;
        let panel = host.querySelector('.mgmt-panel');
        if (!panel) {
            host.innerHTML = this.buildMatchMgmtLayout();
            panel = host.querySelector('.mgmt-panel');
        }
        return panel;
    },

    // Inject the Tactic layout into `host`. Returns the panel root.
    mountTactic(host) {
        if (!host) return null;
        let panel = host.querySelector('.mgmt-panel');
        if (!panel) {
            host.innerHTML = this.buildTacticLayout();
            panel = host.querySelector('.mgmt-panel');
        }
        return panel;
    },

    // Dispatches by host class: .match-mgmt-host → Match Management,
    // .tactic-host → Tactic. Falls back to Match Management.
    mount(host) {
        if (!host) return null;
        if (host.classList.contains('tactic-host')) return this.mountTactic(host);
        return this.mountMatchMgmt(host);
    },

    // ─── Mutators ─────────────────────────────────────────────────────────

    // Set the primary-action button text + click handler. Pass { visible: false }
    // to hide. No-op on scopes without a primary-action slot (e.g. Tactic).
    setPrimaryAction(scope, { text = '', onClick = null, visible = true } = {}) {
        if (!scope) return;
        const btn = scope.querySelector('.primary-action-btn');
        if (!btn) return;
        btn.textContent = text;
        btn.style.display = visible ? 'block' : 'none';
        btn.onclick = onClick;
    },
};
