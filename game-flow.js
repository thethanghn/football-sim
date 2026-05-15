class MatchFlow {
    constructor(pitchRenderer, animEngine) {
        this.pitch  = pitchRenderer;
        this.anim   = animEngine;

        this._idle       = null;
        this._winger     = null;
        this._gkTimer    = null;
        this._ballCancel = null;

        this._home = new Map();
        this._push = { player: 0, cpu: 0 };
        this._ballOwner = null;

        // Attacker movement mode per team.
        // 'hold' → FWDs hover just behind the defensive line (onside).
        // 'run'  → FWDs are making a timed run past the line (off the ball or through ball).
        this._fwdMode     = { player: 'hold', cpu: 'hold' };
        this._fwdRunTimer = { player: null,   cpu: null   };
    }

    // Store the formation base positions.
    // Call this BEFORE start() with the arrays from calculatePositions().
    init(playerPositions, cpuPositions) {
        this._home.clear();
        playerPositions.forEach((p, i) => this._home.set(i,       { x: p.x, y: p.y }));
        cpuPositions.forEach((p, i)    => this._home.set(100 + i, { x: p.x, y: p.y }));
    }

    start() {
        this._push      = { player: 0, cpu: 0 };
        this._ballOwner = null;
        this._idle    = setInterval(() => this._driftTick(),  1900);
        this._winger  = setInterval(() => this._wingerTick(), 950);
        this._gkTimer = setInterval(() => this._gkTick(),    850);
        setTimeout(() => { this._reshape('player', 900); this._reshape('cpu', 900); }, 250);
    }

    stop() {
        clearInterval(this._idle);
        clearInterval(this._winger);
        clearInterval(this._gkTimer);
        this._idle = this._gkTimer = null;
        if (this._ballCancel) this._ballCancel();
        ['player', 'cpu'].forEach(t => {
            if (this._fwdRunTimer[t]) { clearTimeout(this._fwdRunTimer[t]); this._fwdRunTimer[t] = null; }
        });
    }

    onEvent(type, data = {}) {
        ({
            goal:       () => this._evGoal(data),
            chance:     () => this._evChance(data),
            miss:       () => this._evMiss(data),
            bar:        () => this._evBar(data),
            save:       () => this._evSave(data),
            pass:       () => this._evPass(data),
            tackle:     () => this._evTackle(data),
            corner:     () => this._evCorner(data),
            throwin:    () => this._evThrowin(data),
            freekick:   () => this._evFreekick(data),
            offside:    () => this._evOffside(data),
            possession: () => this._evPossession(data),
        }[type] || (() => {}))();
    }

    // ─── Public: offside checking ────────────────────────────────────────────────

    // Returns true if the receiver at receiverPitchId is in an offside position.
    // Only meaningful for forward passes to attackers in the opponent's half.
    checkPassOffside(attackTeam, receiverPitchId) {
        const v = this._vis(receiverPitchId);
        if (!v) return false;
        const rx = v.pitchX;

        // Must be in opponent's half
        if (attackTeam === 'player' && rx <= 50) return false;
        if (attackTeam === 'cpu'    && rx >= 50) return false;

        const line = this.getOffsideLine(attackTeam);
        if (line == null) return false;

        // 2-unit margin — only flag clearly-offside players
        if (attackTeam === 'player') return rx > line + 2;
        else                          return rx < line - 2;
    }

    // Returns the X coordinate of the last outfield defender for the defending team.
    // Defines the offside line: attackers beyond this value are offside.
    getOffsideLine(attackTeam) {
        const defTeam   = attackTeam === 'player' ? 'cpu' : 'player';
        const defOutIds = this._outfield(defTeam);      // GK excluded
        const xs = defOutIds.map(id => this._vis(id)?.pitchX).filter(x => x != null);
        if (xs.length === 0) return null;

        // Player attacks right → last CPU outfield = highest X (closest to CPU goal)
        // CPU attacks left  → last player outfield = lowest X (closest to player goal)
        return attackTeam === 'player' ? Math.max(...xs) : Math.min(...xs);
    }

    // ─── Ball animation ──────────────────────────────────────────────────────────

    _animBall(toPX, toPY, ms = 300, arc = false) {
        if (this._ballCancel) this._ballCancel();
        const ball = this.pitch.ballElement;
        if (!ball) return;

        const fromX = parseFloat(ball.getAttribute('cx'));
        const fromY = parseFloat(ball.getAttribute('cy'));
        const to    = this.pitch.getPixelCoords(toPX, toPY);
        const dist  = Math.hypot(to.x - fromX, to.y - fromY);
        const arcH  = arc ? Math.min(62, dist * 0.22) : 0;

        let dead = false, raf = null;
        this._ballCancel = () => {
            dead = true;
            if (raf) cancelAnimationFrame(raf);
            this._ballCancel = null;
        };

        const t0 = performance.now();
        const tick = now => {
            if (dead) return;
            const t    = Math.min((now - t0) / ms, 1);
            const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
            ball.setAttribute('cx', fromX + (to.x - fromX) * ease);
            ball.setAttribute('cy', (fromY + (to.y - fromY) * ease) - arcH * Math.sin(Math.PI * t));
            if (t < 1) raf = requestAnimationFrame(tick);
            else        this._ballCancel = null;
        };
        raf = requestAnimationFrame(tick);
    }

    _ballTo(id, ms = 300, arc = false) {
        const v = this._vis(id);
        if (!v) return;
        this._ballOwner = id;
        this._animBall(v.pitchX, v.pitchY, ms, arc);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    _vis(id)  { return this.pitch.playerVisuals[id]; }
    _clamp(v, lo = 3, hi = 97) { return Math.max(lo, Math.min(hi, v)); }

    _ids(team) {
        return Object.keys(this.pitch.playerVisuals).map(Number)
            .filter(id => team === 'player' ? id < 100 : id >= 100);
    }
    _outfield(team) { return this._ids(team).filter(id => id !== 0 && id !== 100); }
    _randOf(team) {
        const ids = this._outfield(team);
        return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
    }
    _randOfAll(team) {
        const ids = this._ids(team);
        return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
    }

    _move(id, toX, toY, ms = 500) {
        const v = this._vis(id);
        if (!v) return;
        this.anim.animateMove(id, v.pitchX, v.pitchY, this._clamp(toX), this._clamp(toY), ms);
    }

    _pushMult(id) {
        const h = this._home.get(id);
        if (!h) return 0;
        if (id < 100) {
            if (h.x < 15) return 0.04;
            if (h.x < 35) return 0.50;
            if (h.x < 60) return 1.00;
            return 1.30;
        } else {
            if (h.x > 85) return 0.04;
            if (h.x > 65) return 0.50;
            if (h.x > 40) return 1.00;
            return 1.30;
        }
    }

    // Clamp a forward's X so they stay behind the last outfield defender.
    _onside(id, x) {
        const h = this._home.get(id);
        if (!h) return x;
        if (id < 100 && h.x >= 60) {
            const line = this.getOffsideLine('player');
            if (line != null) return Math.min(x, line - 2);
        } else if (id >= 100 && h.x <= 40) {
            const line = this.getOffsideLine('cpu');
            if (line != null) return Math.max(x, line + 2);
        }
        return x;
    }

    // IDs of forward-row players (home X ≥ 60 for player team, ≤ 40 for CPU).
    _fwdIds(team) {
        return this._ids(team).filter(id => {
            const h = this._home.get(id);
            return h && (team === 'player' ? h.x >= 60 : h.x <= 40);
        });
    }

    // Switch FWDs to 'run' mode: animate them bursting past the defensive line.
    // Auto-reverts to 'hold' after durationMs and snaps them back onside.
    _triggerRun(team, durationMs = 1600) {
        if (this._fwdRunTimer[team]) clearTimeout(this._fwdRunTimer[team]);
        this._fwdMode[team] = 'run';
        const line = this.getOffsideLine(team);
        this._fwdIds(team).forEach(id => {
            const v = this._vis(id);
            if (!v) return;
            const runX = team === 'player'
                ? this._clamp((line ?? 75) + 2 + Math.random() * 10, 50, 96)
                : this._clamp((line ?? 25) - 2 - Math.random() * 10,  4, 50);
            this.anim.animateMove(id, v.pitchX, v.pitchY,
                runX, this._clamp(v.pitchY + (Math.random() - 0.5) * 14),
                320 + Math.random() * 180);
        });
        this._fwdRunTimer[team] = setTimeout(() => {
            this._fwdMode[team]     = 'hold';
            this._fwdRunTimer[team] = null;
            this._snapFwdsOnside(team);
        }, durationMs);
    }

    // Move any FWDs that have strayed offside back to just behind the defensive line.
    _snapFwdsOnside(team) {
        const line = this.getOffsideLine(team);
        this._fwdIds(team).forEach(id => {
            const v = this._vis(id);
            if (!v) return;
            const onX = team === 'player'
                ? Math.min(v.pitchX, (line ?? 78) - 2)
                : Math.max(v.pitchX, (line ?? 22) + 2);
            if (Math.abs(onX - v.pitchX) > 0.8) {
                this.anim.animateMove(id, v.pitchX, v.pitchY,
                    this._clamp(onX), this._clamp(v.pitchY + (Math.random() - 0.5) * 4),
                    380 + Math.random() * 220);
            }
        });
    }

    _targetPos(id) {
        const h = this._home.get(id);
        if (!h) return null;
        const team   = id < 100 ? 'player' : 'cpu';
        const push   = this._push[team];
        const offset = push * this._pushMult(id);
        let x = id < 100 ? h.x + offset : h.x - offset;
        // In hold mode, FWDs' target position is also bounded by the offside line.
        if (this._fwdMode[team] === 'hold') x = this._onside(id, x);
        return { x: this._clamp(x), y: h.y };
    }

    _reshape(team, ms = 650) {
        this._ids(team).forEach(id => {
            const t = this._targetPos(id);
            const v = this._vis(id);
            if (!t || !v) return;
            const jY = this._clamp(t.y + (Math.random() - 0.5) * 6);
            this.anim.animateMove(id, v.pitchX, v.pitchY, t.x, jY, ms + Math.random() * 350);
        });
    }

    _applyPush(team, delta) {
        const opp = team === 'player' ? 'cpu' : 'player';
        this._push[team] = Math.max(-10, Math.min(15, this._push[team] + delta));
        this._push[opp]  = Math.max(-10, Math.min(15, this._push[opp]  - delta * 0.45));
        this._reshape(team, 650);
        this._reshape(opp,  820);
    }

    // ─── Idle drift ───────────────────────────────────────────────────────────────

    // Returns true for players with a wide home position (LM/RM/LB/RB/LWB/RWB by y location)
    _isWide(id) {
        const h = this._home.get(id);
        return h && (h.y < 28 || h.y > 72);
    }

    // Wingers: wide AND in the forward third (LW/RW, wide forwards in 343/433/352).
    // Full-backs and wide mids are wide but not forward, so they don't qualify.
    _isWinger(id) {
        const h = this._home.get(id);
        if (!h) return false;
        const wide    = h.y < 28 || h.y > 72;
        const forward = id < 100 ? h.x >= 55 : h.x <= 45;
        return wide && forward;
    }

    _driftTick() {
        ['player', 'cpu'].forEach(team => {
            this._outfield(team)
                .sort(() => Math.random() - 0.5)
                .slice(0, 4)
                .forEach(id => {
                    const t  = this._targetPos(id);
                    const v  = this._vis(id);
                    if (!t || !v) return;

                    const lo = team === 'player' ?  4 : 30;
                    const hi = team === 'player' ? 70 : 96;

                    const h      = this._home.get(id);
                    const isFwd  = h && (team === 'player' ? h.x >= 60 : h.x <= 40);
                    const isWide = this._isWide(id);
                    const yAmp   = isWide ? 15 : 8; // wide players drift further up/down
                    let nx, ny;

                    if (isFwd && this._fwdMode[team] === 'hold') {
                        const line = this.getOffsideLine(team);
                        if (line != null) {
                            const hoverX = team === 'player'
                                ? line - 0.5 - Math.random() * 4
                                : line + 0.5 + Math.random() * 4;
                            nx = this._clamp(hoverX, lo, hi);
                        } else {
                            nx = this._clamp(this._onside(id, t.x + (Math.random() - 0.5) * 6), lo, hi);
                        }
                        ny = this._clamp(t.y + (Math.random() - 0.5) * 12);
                    } else {
                        nx = this._clamp(t.x + (Math.random() - 0.5) * 10, lo, hi);
                        ny = this._clamp(t.y + (Math.random() - 0.5) * yAmp);
                    }
                    const ms = 700 + Math.random() * 600;

                    this.anim.animateMove(id, v.pitchX, v.pitchY, nx, ny, ms);
                    if (id === this._ballOwner) this._animBall(nx, ny, ms * 0.85);
                });
        });
    }

    // Dedicated fast tick for wide players (wingers, full-backs) — runs 2× faster than driftTick.
    // Wingers get a markedly larger movement zone, modulated by attack/defence phase:
    //   • Attacking  → big lateral runs, push high, cut inside (drift toward Y=50), wider X spread.
    //   • Defending  → tuck back narrower toward home X/Y.
    //   • Off-ball far-side runs → when their team has the ball on the opposite flank, drift
    //     toward the near/far post (a winger arriving at the back stick).
    _wingerTick() {
        ['player', 'cpu'].forEach(team => {
            const wideIds = this._outfield(team).filter(id => this._isWide(id));
            if (!wideIds.length) return;

            // Per-team attacking pressure (-10..+15). Positive = pushing forward.
            const push       = this._push[team];
            const attacking  = push > 2;
            const retreating = push < -2;

            // Where's the ball, in pitch coords? Used for "winger on the far side" runs.
            let ballX = null, ballY = null;
            const ballEl = this.pitch?.ballElement;
            if (ballEl && this.pitch.getPitchCoords) {
                const c = this.pitch.getPitchCoords(parseFloat(ballEl.getAttribute('cx')),
                                                   parseFloat(ballEl.getAttribute('cy')));
                ballX = c.pitchX; ballY = c.pitchY;
            }

            // Move 1–2 wide players per tick to keep movement staggered, not synchronised
            const pick = wideIds.sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.6 ? 1 : 2);
            pick.forEach(id => {
                const t = this._targetPos(id);
                const v = this._vis(id);
                if (!t || !v) return;

                const h        = this._home.get(id);
                const isFwd    = h && (team === 'player' ? h.x >= 60 : h.x <= 40);
                const isWinger = this._isWinger(id);
                // Attacking wingers earn a wider X clamp so they can push into the opponent's box.
                const wingerAtkClamp = isWinger && push > 2;
                const lo = wingerAtkClamp ? (team === 'player' ? 20 :  4) : (team === 'player' ?  4 : 30);
                const hi = wingerAtkClamp ? (team === 'player' ? 96 : 80) : (team === 'player' ? 70 : 96);

                // Decide movement amplitudes by role + phase
                let yRun, xRun, msBase, msJit;
                if (isWinger && attacking) {
                    // Wingers in attack: big runs, push high, big lateral coverage
                    yRun   = (Math.random() - 0.5) * 38;             // ±19 lateral units
                    xRun   = team === 'player'
                                ? 4 + Math.random() * 9              // sprint forward
                                : -(4 + Math.random() * 9);
                    msBase = 380; msJit = 320;                       // faster animations
                } else if (isWinger && retreating) {
                    // Tucking back to help defend
                    yRun   = (Math.random() - 0.5) * 12;
                    xRun   = team === 'player' ? -(2 + Math.random() * 6) : (2 + Math.random() * 6);
                    msBase = 600; msJit = 400;
                } else if (isWinger) {
                    // Neutral phase: still wider than baseline
                    yRun   = (Math.random() - 0.5) * 26;
                    xRun   = (Math.random() - 0.5) * 11;
                    msBase = 480; msJit = 420;
                } else {
                    // Non-winger wide players (full-backs, wide mids): original behaviour
                    yRun   = (Math.random() - 0.5) * 22;
                    xRun   = (Math.random() - 0.5) * 8;
                    msBase = 500; msJit = 450;
                }

                // Compute targets
                let nx, ny;

                if (isFwd && this._fwdMode[team] === 'hold') {
                    const line = this.getOffsideLine(team);
                    nx = this._clamp(line != null
                        ? (team === 'player' ? line - 0.5 - Math.random() * 5 : line + 0.5 + Math.random() * 5)
                        : this._onside(id, t.x + xRun), lo, hi);
                    ny = this._clamp(t.y + yRun);
                } else {
                    nx = this._clamp(t.x + xRun, lo, hi);
                    ny = this._clamp(t.y + yRun);
                }

                // Winger flair: cut inside on attacks, or arrive at far post when ball is wide on the other flank
                if (isWinger && attacking) {
                    const homeTopHalf = h.y < 50;
                    const ballOnOppFlank = ballX != null
                        && (team === 'player' ? ballX >= 50 : ballX <= 50)   // ball in attacking half
                        && ballY != null
                        && (homeTopHalf ? ballY > 60 : ballY < 40);

                    if (ballOnOppFlank && Math.random() < 0.55) {
                        // Far-post run: aim for the back stick zone in the box
                        const boxX = team === 'player' ? 86 + Math.random() * 8 : 14 - Math.random() * 8;
                        const postY = homeTopHalf ? 38 + Math.random() * 8 : 54 + Math.random() * 8;
                        nx = this._clamp(boxX, lo, hi);
                        ny = this._clamp(postY);
                    } else if (Math.random() < 0.40) {
                        // Cut inside: bias Y back toward the centre half-space (~30–40 / 60–70)
                        const target = homeTopHalf ? 32 + Math.random() * 10 : 58 + Math.random() * 10;
                        ny = this._clamp(t.y + (target - t.y) * (0.5 + Math.random() * 0.3));
                    }
                }

                const ms = msBase + Math.random() * msJit;
                this.anim.animateMove(id, v.pitchX, v.pitchY, nx, ny, ms);
                if (id === this._ballOwner) this._animBall(nx, ny, ms * 0.85);
            });
        });
    }

    // ─── GK homing ────────────────────────────────────────────────────────────────

    _gkTick() {
        [[0, 8, 50], [100, 92, 50]].forEach(([id, hx, hy]) => {
            const v = this._vis(id);
            if (!v) return;
            if (Math.abs(v.pitchX - hx) > 5 || Math.abs(v.pitchY - hy) > 14) {
                this.anim.animateMove(id, v.pitchX, v.pitchY,
                    hx + (Math.random() - 0.5) * 3,
                    hy + (Math.random() - 0.5) * 14, 650);
            }
        });
    }

    // ─── Event handlers ───────────────────────────────────────────────────────────

    _evPass({ passer, receiver, team }) {
        if (!team) return;

        let passId = (passer   != null && this._vis(passer))   ? passer   : this._randOf(team);
        let recvId = (receiver != null && this._vis(receiver)) ? receiver : this._randOf(team);
        if (passId == null || recvId == null) return;
        if (passId === recvId) {
            const others = this._outfield(team).filter(id => id !== passId);
            recvId = others.length ? others[Math.floor(Math.random() * others.length)] : null;
            if (!recvId) return;
        }

        const pv = this._vis(passId);
        const rv = this._vis(recvId);
        if (!pv || !rv) return;

        // If the receiver is in the forward row, trigger a timed run past the line.
        const rh = this._home.get(recvId);
        const recvIsFwd = rh && (team === 'player' ? rh.x >= 60 : rh.x <= 40);
        if (recvIsFwd) this._triggerRun(team, 1800);

        this._ballOwner = passId;
        this._animBall(pv.pitchX, pv.pitchY, 90);
        setTimeout(() => {
            this._ballTo(recvId, 340);
            this._move(recvId, rv.pitchX + (Math.random()-0.5)*5, rv.pitchY + (Math.random()-0.5)*4, 370);
        }, 100);

        this._applyPush(team, 2.5);
    }

    _evGoal({ scorer, team }) {
        if (!team) return;
        const goalX = team === 'player' ? 97 : 3;
        const goalY = 50 + (Math.random() - 0.5) * 16;

        if (scorer != null && this._vis(scorer)) {
            const sv = this._vis(scorer);
            this._ballOwner = scorer;
            this._animBall(sv.pitchX, sv.pitchY, 80);
            setTimeout(() => {
                this._ballOwner = null;
                this._animBall(goalX, goalY, 500, true);
                this.anim.animateMove(scorer, sv.pitchX, sv.pitchY,
                    this._clamp(goalX + (team === 'player' ? -7 : 7)), this._clamp(goalY), 680);
            }, 90);
        } else {
            this._ballOwner = null;
            this._animBall(goalX, goalY, 500, true);
        }

        setTimeout(() => {
            this._outfield(team).filter(id => id !== scorer)
                .sort(() => Math.random() - 0.5).slice(0, 3)
                .forEach(id => this._move(id,
                    goalX + (team === 'player' ? -14 : 14) + (Math.random()-0.5)*18,
                    goalY + (Math.random()-0.5)*24,
                    800 + Math.random()*500));
        }, 580);

        const opp = team === 'player' ? 'cpu' : 'player';
        this._push[opp]  = -8;
        this._push[team] =  4;
        this._reshape(opp, 1100);

        setTimeout(() => this._doKickoff(), 5200);
    }

    _evChance({ team }) {
        if (!team) return;
        const attId = this._randOf(team);
        if (attId == null) return;

        const goalX = team === 'player' ? 89 : 11;
        const goalY = 50 + (Math.random() - 0.5) * 24;

        // All FWDs burst toward goal as the chance develops
        this._triggerRun(team, 1600);

        this._ballTo(attId, 240);
        setTimeout(() => {
            this._move(attId, goalX, goalY, 460);
            setTimeout(() => {
                this._ballOwner = null;
                this._animBall(goalX + (team === 'player' ? 7 : -7), goalY, 380, true);
            }, 280);
        }, 250);

        this._applyPush(team, 5);
    }

    _evMiss({ team }) {
        if (!team) return;
        const attId = this._randOf(team);
        if (attId != null) this._ballTo(attId, 200);

        setTimeout(() => {
            const wideY = Math.random() > 0.5
                ? 50 + 32 + Math.random() * 14
                : 50 - 32 - Math.random() * 14;
            this._ballOwner = null;
            this._animBall(team === 'player' ? 100 : 0, this._clamp(wideY, 0, 100), 410);
        }, 230);

        // Missed — attacking team lost the ball, FWDs retreat onside
        this._snapFwdsOnside(team);
        this._applyPush(team, -3);
    }

    _evBar({ team }) {
        if (!team) return;
        const attId = this._randOf(team);
        if (attId != null) this._ballTo(attId, 180);

        setTimeout(() => {
            this._ballOwner = null;
            this._animBall(team === 'player' ? 100 : 0, 50 + (Math.random()-0.5)*10, 390, true);
        }, 200);
        setTimeout(() => {
            this._animBall(
                team === 'player' ? 76+Math.random()*13 : 11+Math.random()*13,
                50 + (Math.random()-0.5)*32, 330);
        }, 640);

        // Ball off the bar — possession uncertain, snap FWDs back onside
        this._snapFwdsOnside(team);
        this._applyPush(team, -2);
    }

    _evSave({ team }) {
        if (!team) return;
        const gkId  = team === 'player' ? 0 : 100;
        const homeX = team === 'player' ? 8  : 92;
        const homeY = 50;
        const gkV   = this._vis(gkId);
        const attTeam = team === 'player' ? 'cpu' : 'player';

        this._ballOwner = null;
        this._animBall(homeX, homeY + (Math.random()-0.5)*16, 360, true);

        if (gkV) {
            this.anim.animateMove(gkId, gkV.pitchX, gkV.pitchY,
                homeX + (team === 'player' ? 3 : -3),
                homeY + (Math.random()-0.5)*22, 330);
        }

        // Attack repelled — attacking FWDs drop back onside immediately
        this._snapFwdsOnside(attTeam);

        setTimeout(() => {
            const outId = this._randOf(team);
            if (outId) {
                this._ballTo(outId, 360);
                this._applyPush(team, 3);
            } else {
                this._animBall(
                    team === 'player' ? 22+Math.random()*14 : 64+Math.random()*14,
                    50+(Math.random()-0.5)*30, 360);
            }
        }, 460);
    }

    _evTackle({ team }) {
        if (!team) return;
        const opp   = team === 'player' ? 'cpu' : 'player';
        const defId = this._randOf(team);
        const attId = (this._ballOwner != null && this._outfield(opp).includes(this._ballOwner))
                      ? this._ballOwner : this._randOf(opp);
        if (defId == null || attId == null) return;

        const dv = this._vis(defId);
        const av = this._vis(attId);
        if (!dv || !av) return;

        const midX = (dv.pitchX + av.pitchX) / 2;
        const midY = (dv.pitchY + av.pitchY) / 2;

        this._ballOwner = attId;
        this._animBall(av.pitchX, av.pitchY, 75);
        this.anim.animateMove(defId, dv.pitchX, dv.pitchY, midX, midY, 290);
        this.anim.animateMove(attId, av.pitchX, av.pitchY, midX, midY, 290);

        setTimeout(() => this._animBall(midX, midY, 230), 80);

        setTimeout(() => {
            this._ballOwner = defId;
            const clearX = team === 'player' ? 28+Math.random()*32 : 40+Math.random()*32;
            this._animBall(clearX, 24+Math.random()*52, 340);
            const outId = this._randOf(team);
            if (outId) setTimeout(() => this._ballTo(outId, 270), 360);
        }, 350);

        // Tackled team lost possession — their FWDs check run and drop back onside
        this._snapFwdsOnside(opp);
        this._applyPush(team, 4);
    }

    // ─── Corner kick ──────────────────────────────────────────────────────────────
    // Player positions: taker at flag, attackers flood box (near post / far post /
    // penalty spot / edge), defenders mark zonal, GK holds goal line.

    _evCorner({ team }) {
        if (!team) return;
        const defTeam = team === 'player' ? 'cpu' : 'player';
        const cornerX = team === 'player' ? 99 : 1;
        const cornerY = Math.random() > 0.5 ? 3 : 97;  // top or bottom corner flag

        // Ball to corner flag
        this._ballOwner = null;
        this._animBall(cornerX, cornerY, 400);

        // Corner taker walks to flag
        const takerId = this._randOf(team);
        if (takerId != null) {
            this._move(takerId, this._clamp(cornerX + (team === 'player' ? -3 : 3)), cornerY, 520);
        }

        // Attacking box positions: near post, far post, penalty spot, edge of box.
        // All animations kept under 680ms so they complete before the cross at t=750ms.
        const boxAnchorX = team === 'player' ? 87 : 13;
        const boxSpots = [
            [boxAnchorX - 4, 38],   // near post zone
            [boxAnchorX - 4, 62],   // far post zone
            [boxAnchorX - 8, 50],   // penalty spot
            [boxAnchorX - 14, 44],  // edge of box left
            [boxAnchorX - 14, 56],  // edge of box right
        ];
        const atkIds = this._outfield(team).filter(id => id !== takerId);
        atkIds.slice(0, boxSpots.length).forEach((id, i) => {
            const [bx, by] = boxSpots[i];
            this._move(id, this._clamp(bx + (Math.random()-0.5)*5), this._clamp(by + (Math.random()-0.5)*6),
                       460 + i * 40);   // max 460+4*40=620ms
        });

        // Defending: GK on goal line between posts, outfield marks zonally
        const gkId = defTeam === 'player' ? 0 : 100;
        const gkHomeX = defTeam === 'player' ? 8 : 92;
        const gkV = this._vis(gkId);
        if (gkV) {
            const gkY = cornerY < 50 ? 38 : 62;
            this.anim.animateMove(gkId, gkV.pitchX, gkV.pitchY, gkHomeX, gkY, 480);
        }

        // Defenders flood the box — defending side outnumbers attackers at corners.
        // 6-yard line, penalty spot band, and edge-of-box, plus one outlet left outside.
        const defBoxX = team === 'player' ? 91 : 9;
        const sign = team === 'player' ? -1 : 1;
        const defSpots = [
            [defBoxX + sign * 3,  cornerY < 50 ? 35 : 65],   // near post
            [defBoxX + sign * 3,  cornerY < 50 ? 62 : 38],   // far post
            [gkHomeX - sign * 5,  50],                        // 6-yard middle
            [defBoxX + sign * 8,  cornerY < 50 ? 42 : 58],   // penalty spot, near side
            [defBoxX + sign * 8,  50],                        // penalty spot, center
            [defBoxX + sign * 8,  cornerY < 50 ? 58 : 42],   // penalty spot, far side
            [defBoxX + sign * 16, 44],                        // edge of box, near
            [defBoxX + sign * 16, 56],                        // edge of box, far
        ];
        this._outfield(defTeam).slice(0, defSpots.length).forEach((id, i) => {
            const [dx, dy] = defSpots[i];
            this._move(id, this._clamp(dx + (Math.random()-0.5)*4), this._clamp(dy + (Math.random()-0.5)*5),
                       450 + i * 30);   // max 450+7*30=660ms, still completes before cross at t=750
        });

        // All setup animations ≤ 640ms. At 750ms, deliver the cross and
        // switch FWDs to run mode so they attack the ball in the box.
        setTimeout(() => {
            const crossX = team === 'player' ? 84 + Math.random() * 8 : 8 + Math.random() * 8;
            const crossY = 33 + Math.random() * 34;
            this._ballOwner = null;
            this._animBall(crossX, crossY, 520, true);

            // FWDs burst to attack the cross — offside doesn't apply at corners
            this._fwdMode[team] = 'run';
            if (this._fwdRunTimer[team]) clearTimeout(this._fwdRunTimer[team]);
            this._fwdRunTimer[team] = setTimeout(() => {
                this._fwdMode[team]     = 'hold';
                this._fwdRunTimer[team] = null;
                this._snapFwdsOnside(team);
            }, 2400);

            this._applyPush(team, 8);

            setTimeout(() => {
                const winner = atkIds.length
                    ? atkIds[Math.floor(Math.random() * Math.min(3, atkIds.length))]
                    : null;
                if (winner) this._ballTo(winner, 250);
            }, 560);
        }, 750);
    }

    // ─── Throw-in ─────────────────────────────────────────────────────────────────
    // Thrower walks to touchline. Two teammates move nearby to receive.
    // After pause the ball is thrown infield.

    _evThrowin({ team, sideY, throwX }) {
        if (!team) return;
        const sy = sideY != null ? sideY : (Math.random() > 0.5 ? 2 : 98);
        const tx = throwX != null ? throwX : 18 + Math.random() * 64;
        // Infield Y — opposite side from touchline, moderately close
        const innerY = sy < 50 ? 20 + Math.random() * 20 : 60 + Math.random() * 20;

        // Ball rolls to touchline spot
        this._ballOwner = null;
        this._animBall(tx, sy, 300);

        // Thrower goes to touchline
        const throwerId = this._randOf(team);
        if (throwerId != null) {
            this._move(throwerId, tx, sy < 50 ? 4 : 96, 480);
        }

        // 2 teammates fan out nearby to receive
        this._outfield(team)
            .filter(id => id !== throwerId)
            .slice(0, 2)
            .forEach((id, i) => {
                const rx = this._clamp(tx + (i === 0 ? -12 : 12) + (Math.random()-0.5)*6);
                const ry = this._clamp(innerY + (Math.random()-0.5)*12);
                this._move(id, rx, ry, 500 + i * 80);
            });

        // Opponents drop off — don't crowd the thrower
        this._outfield(team === 'player' ? 'cpu' : 'player')
            .slice(0, 3)
            .forEach(id => {
                const t = this._targetPos(id);
                if (t) this._move(id, t.x + (Math.random()-0.5)*6, t.y + (Math.random()-0.5)*6, 600);
            });

        // After setup, throw the ball in
        setTimeout(() => {
            // Pick receiver closest to inner zone
            const recvId = this._outfield(team)
                .filter(id => id !== throwerId)
                .sort((a, b) => {
                    const va = this._vis(a), vb = this._vis(b);
                    if (!va || !vb) return 0;
                    return Math.abs(va.pitchY - innerY) - Math.abs(vb.pitchY - innerY);
                })[0];
            if (recvId != null) {
                this._ballOwner = null;
                const rv = this._vis(recvId);
                if (rv) {
                    this._animBall(rv.pitchX, rv.pitchY, 360, true);
                    setTimeout(() => {
                        this._ballTo(recvId, 220);
                        this._applyPush(team, 1.5);
                    }, 390);
                }
            }
        }, 680);
    }

    // ─── Free kick ────────────────────────────────────────────────────────────────
    // Attacking team lines up at the spot. Defending team builds a 4-man wall
    // 10 pitch units from the ball. GK holds goal line behind wall.
    // After 1.2 s the kick is played.

    _evFreekick({ team, x, y }) {
        if (!team) return;
        const defTeam = team === 'player' ? 'cpu' : 'player';

        // Default to a spot in the attacking half if not supplied
        const bx = x != null ? x : (team === 'player' ? 62 + Math.random() * 20 : 18 + Math.random() * 20);
        const by = y != null ? y : 28 + Math.random() * 44;

        // Ball to freekick spot
        this._ballOwner = null;
        this._animBall(bx, by, 380);

        // ── Defending team: wall + GK ─────────────────────────
        // Wall 10 units in front of ball toward the defending goal
        const wallX = this._clamp(team === 'player' ? bx + 10 : bx - 10);
        const wallIds = this._outfield(defTeam).slice(0, 4);
        wallIds.forEach((id, i) => {
            // Wall players spread vertically around ball's Y
            const wallY = this._clamp(by + (i - 1.5) * 3.8);
            this._move(id, wallX, wallY, 500 + i * 70);
        });

        // Remaining defenders hold their shape further back
        this._outfield(defTeam).filter(id => !wallIds.includes(id)).forEach((id, i) => {
            const t = this._targetPos(id);
            if (t) this._move(id, t.x, this._clamp(t.y + (Math.random()-0.5)*4), 620 + i * 90);
        });

        // GK positions behind wall, slightly toward near post
        const gkId  = defTeam === 'player' ? 0 : 100;
        const gkHomeX = defTeam === 'player' ? 8 : 92;
        const gkV   = this._vis(gkId);
        if (gkV) {
            this.anim.animateMove(gkId, gkV.pitchX, gkV.pitchY,
                gkHomeX, this._clamp(by + (Math.random()-0.5)*8), 520);
        }

        // ── Attacking team: taker + runners ───────────────────
        const atkIds = this._outfield(team);

        // Taker stands over the ball
        if (atkIds.length > 0) {
            this._move(atkIds[0], bx + (team === 'player' ? -3 : 3), by, 400);
        }
        // Second player as decoy/dummy run
        if (atkIds.length > 1) {
            this._move(atkIds[1], bx + (team === 'player' ? -5 : 5), this._clamp(by + 5), 420);
        }

        // Rest spread into the penalty box
        const pBoxAnchorX = team === 'player' ? 83 : 17;
        atkIds.slice(2, 6).forEach((id, i) => {
            const px = this._clamp(pBoxAnchorX + (Math.random()-0.5)*12);
            const py = this._clamp(35 + i * 9 + (Math.random()-0.5)*6);
            this._move(id, px, py, 560 + i * 80);
        });

        // After all setup animations (≤ 800ms), take the kick.
        // FWDs switch to run mode so they burst into the box.
        setTimeout(() => {
            const targetX = team === 'player'
                ? 82 + Math.random() * 10
                : 8  + Math.random() * 10;
            const targetY = 33 + Math.random() * 34;

            this._fwdMode[team] = 'run';
            if (this._fwdRunTimer[team]) clearTimeout(this._fwdRunTimer[team]);
            this._fwdRunTimer[team] = setTimeout(() => {
                this._fwdMode[team]     = 'hold';
                this._fwdRunTimer[team] = null;
                this._snapFwdsOnside(team);
            }, 2600);

            this._ballOwner = null;
            this._animBall(targetX, targetY, 540, true);
            this._applyPush(team, 5);

            setTimeout(() => {
                const recvId = atkIds.length > 2
                    ? atkIds[2 + Math.floor(Math.random() * Math.max(1, atkIds.length - 2))]
                    : (atkIds.length > 0 ? atkIds[0] : null);
                if (recvId != null) this._ballTo(recvId, 280);
            }, 580);
        }, 1200);
    }

    // ─── Offside ──────────────────────────────────────────────────────────────────
    // Assistant raises flag. Play stops. Ball handed to defending team.

    _evOffside({ team }) {
        if (!team) return;
        const defTeam = team === 'player' ? 'cpu' : 'player';

        // Ball snaps to the offside line (where flag is raised)
        const line = this.getOffsideLine(team);
        const flagX = line != null ? line : (team === 'player' ? 75 : 25);
        this._ballOwner = null;
        this._animBall(flagX, 50 + (Math.random()-0.5)*28, 350);

        // Attackers must retreat behind the ball — drop shape back
        this._applyPush(team, -5);

        // Defending team takes the indirect free kick
        setTimeout(() => {
            const recvId = this._randOf(defTeam);
            if (recvId != null) {
                this._ballTo(recvId, 380);
                this._applyPush(defTeam, 2);
            }
        }, 900);
    }

    _evPossession({ team } = {}) {
        if (!team) return;
        const pid = this._randOf(team);
        if (pid) {
            this._ballTo(pid, 380);
            this._applyPush(team, 2);
        }
    }

    // ─── Kickoff reset ────────────────────────────────────────────────────────────

    _doKickoff() {
        ['player', 'cpu'].forEach(t => {
            if (this._fwdRunTimer[t]) { clearTimeout(this._fwdRunTimer[t]); this._fwdRunTimer[t] = null; }
            this._fwdMode[t] = 'hold';
        });
        this._push.player = 0;
        this._push.cpu    = 0;
        this._ballOwner   = null;
        this._animBall(50, 50, 580);
        this._reshape('player', 950);
        this._reshape('cpu',    950);
    }
}
