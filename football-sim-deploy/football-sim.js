        // Phaser-backed pitch renderer. Public API surface (createPitchSVG / renderPlayer /
        // updatePlayerPosition / renderBall / updateStamina / getPixelCoords / getPitchCoords /
        // calculatePositions) and the shapes of `playerVisuals[id]` / `ballElement` are
        // preserved so the rest of the codebase — AnimationEngine, MatchFlow's _animBall, the
        // simulator's setup code — works unchanged. The SVG element is replaced by a Phaser
        // canvas; SVG attribute access (`setAttribute('cx', ...)` / `setAttribute('transform',
        // ...)`) is provided via compatibility shims on the visual / ball objects.
        class PitchRenderer {
            constructor() {
                this.width = 800;
                this.height = 500;
                this.pitchWidth = 100;
                this.pitchHeight = 100;
                this.playerVisuals = {};
                this.ballElement = null;
                this.svg = null;          // kept for backwards-compat readers; not used by Phaser
                this.game = null;
                this.scene = null;
                this._sceneReady = false;
                this._pending = [];       // ops queued until Phaser scene is ready
            }

            // Async-ready helper. Defers `fn` until the Phaser scene is set up.
            _enqueue(fn) {
                if (this._sceneReady) fn();
                else this._pending.push(fn);
            }

            createPitchSVG(containerId) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';

                // Reset state on re-init (new match without page reload).
                this.playerVisuals = {};
                this.ballElement = null;
                this._sceneReady = false;
                this._pending = [];
                if (this.game) { try { this.game.destroy(true, false); } catch (e) {} this.game = null; }

                const self = this;
                this.game = new Phaser.Game({
                    type: Phaser.AUTO,
                    width: this.width,
                    height: this.height,
                    parent: container,
                    transparent: true,
                    backgroundColor: 0x1a7a1a,
                    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
                    scene: {
                        create() {
                            self.scene = this;
                            self._drawPitchLines();
                            self._sceneReady = true;
                            // Flush any operations queued before the scene was ready
                            const queued = self._pending.slice();
                            self._pending = [];
                            queued.forEach(fn => fn());
                        }
                    }
                });
                return null;
            }

            _drawPitchLines() {
                const g = this.scene.add.graphics();
                const m = 20;
                const w = this.width, h = this.height;
                const x1 = m, x2 = w - m, y1 = m, y2 = h - m;
                const xMid = (x1 + x2) / 2, yMid = (y1 + y2) / 2;

                // Pitch outline + grass tint (the canvas already has the green background
                // from `backgroundColor: 0x1a7a1a`, but we draw the touchline rectangle anyway).
                g.lineStyle(2, 0xffffff, 1);
                g.strokeRect(m, m, w - 2*m, h - 2*m);

                // Centre line, centre circle, centre spot
                g.lineStyle(1.5, 0xffffff, 1);
                g.lineBetween(xMid, y1, xMid, y2);
                g.strokeCircle(xMid, yMid, 40);
                g.fillStyle(0xffffff, 1);
                g.fillCircle(xMid, yMid, 3);

                // Penalty areas + goal areas (both halves)
                const boxWidth = 150, boxHeight = 100, goalAreaHeight = 50;
                g.lineStyle(1.5, 0xffffff, 1);
                g.strokeRect(x1,           yMid - boxHeight/2, boxWidth, boxHeight);
                g.strokeRect(x2 - boxWidth, yMid - boxHeight/2, boxWidth, boxHeight);
                g.strokeRect(x1,           yMid - goalAreaHeight/2, 60, goalAreaHeight);
                g.strokeRect(x2 - 60,      yMid - goalAreaHeight/2, 60, goalAreaHeight);

                // Corner arcs (90° quadrants)
                const arc = (cx, cy, startA, endA) => {
                    g.beginPath();
                    g.arc(cx, cy, 20, Phaser.Math.DegToRad(startA), Phaser.Math.DegToRad(endA), false);
                    g.strokePath();
                };
                arc(x1, y1,   0,  90);   // top-left
                arc(x2, y1,  90, 180);   // top-right
                arc(x2, y2, 180, 270);   // bottom-right
                arc(x1, y2, 270, 360);   // bottom-left
            }

            getPixelCoords(pitchX, pitchY) {
                const margin = 20;
                const x = margin + (pitchX / this.pitchWidth) * (this.width - 2*margin);
                const y = margin + (pitchY / this.pitchHeight) * (this.height - 2*margin);
                return { x, y };
            }

            getPitchCoords(pixelX, pixelY) {
                const margin = 20;
                const pitchX = ((pixelX - margin) / (this.width - 2*margin)) * this.pitchWidth;
                const pitchY = ((pixelY - margin) / (this.height - 2*margin)) * this.pitchHeight;
                return { pitchX, pitchY };
            }

            calculatePositions(formation, teamId) {
                const positions = [];
                const team1 = teamId === 1;
                const [gk, def, mid, fwd] = formation;

                // Team 1 (left side, defending X=0-20)
                // Team 2 (right side, defending X=80-100)

                // GK position - at goal line
                positions.push({ pos: 'GK', x: team1 ? 8 : 92, y: 50 });

                // Defenders - vertical line near goal
                const defX = team1 ? 20 : 80;
                const defY = this.getLinePositions(def, 10, 90);
                defY.forEach((y, i) => positions.push({ pos: `DEF${i}`, x: defX, y }));

                // Midfielders - vertical line in midfield
                const midX = team1 ? 45 : 55;
                const midY = this.getLinePositions(mid, 10, 90);
                midY.forEach((y, i) => positions.push({ pos: `MID${i}`, x: midX, y }));

                // Forwards - vertical line near opponent goal
                const fwdX = team1 ? 75 : 25;
                const fwdY = this.getLinePositions(fwd, 25, 75);
                fwdY.forEach((y, i) => positions.push({ pos: `FWD${i}`, x: fwdX, y }));

                return positions;
            }

            getLinePositions(count, minX, maxX) {
                if (count === 1) return [(minX + maxX) / 2];
                const spacing = (maxX - minX) / (count - 1);
                return Array.from({ length: count }, (_, i) => minX + i * spacing);
            }

            // Convert a CSS-style hex (#RRGGBB) to the 0xRRGGBB integer Phaser wants.
            _hex(str) {
                if (typeof str !== 'string') return 0xFF0000;
                return parseInt(str.replace('#', ''), 16) || 0xFF0000;
            }

            renderPlayer(playerId, x, y, playerNumber, color, playerName) {
                const coords = this.getPixelCoords(x, y);
                const radius = 8;
                const teamColor = color || (playerId < 100 ? '#FF0000' : '#0000FF');

                // Pre-create the visual record so downstream code that immediately reads
                // playerVisuals[id].pitchX / pitchY works even before the scene is ready.
                const visual = {
                    element: null,        // Phaser Container (filled in once scene exists)
                    x: coords.x, y: coords.y, pitchX: x, pitchY: y,
                    staminaFill: null, staminaWidth: 16,
                    // CM 03/04-style on-pitch player status — filled in below.
                    ratingBg:    null,
                    ratingText:  null,
                    cardIcon:    null,
                    injuryIcon:  null,
                };
                this.playerVisuals[playerId] = visual;

                this._enqueue(() => {
                    const container = this.scene.add.container(coords.x, coords.y);

                    const circle = this.scene.add.circle(0, 0, radius, this._hex(teamColor));
                    circle.setStrokeStyle(1, 0xffffff, 1);
                    container.add(circle);

                    const numText = this.scene.add.text(0, 0, String(playerNumber), {
                        fontFamily: 'Arial', fontStyle: 'bold', fontSize: '9px', color: '#ffffff'
                    }).setOrigin(0.5);
                    container.add(numText);

                    // Stamina bar — 16 × 2.5 px, anchored ~6 px above the circle
                    const stamY = -radius - 6;
                    const stamBg = this.scene.add.rectangle(0, stamY, 16, 2.5, 0x000000, 0.65)
                        .setStrokeStyle(0.3, 0xffffff, 0.4);
                    container.add(stamBg);
                    const stamFill = this.scene.add.rectangle(-8, stamY, 16, 2.5, 0x22C55E)
                        .setOrigin(0, 0.5);
                    container.add(stamFill);

                    if (playerName) {
                        // Bigger, more legible name pill — 14px text + wider pill.
                        const shortName = playerName.split(' ').pop();
                        const approxW = shortName.length * 7.6 + 8;
                        const nameBg = this.scene.add.rectangle(0, radius + 14, approxW, 20, 0x000000, 0.70)
                            .setStrokeStyle(0.4, 0xffffff, 0.20)
                            .setOrigin(0.5);
                        container.add(nameBg);
                        const nameText = this.scene.add.text(0, radius + 14, shortName, {
                            fontFamily: 'Arial', fontStyle: 'bold', fontSize: '14px', color: '#ffffff'
                        }).setOrigin(0.5);
                        container.add(nameText);
                    }

                    // ── Status badges ─────────────────────────────────────
                    // Bigger, more readable chrome around the player circle.
                    // Rating bubble (top-right) — colour-coded tier badge.
                    const ratingBg = this.scene.add.rectangle(13, -radius - 5, 22, 13, 0xFACC15)
                        .setStrokeStyle(0.8, 0x000000, 1)
                        .setAlpha(0);
                    container.add(ratingBg);
                    const ratingText = this.scene.add.text(13, -radius - 5, '', {
                        fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#111111'
                    }).setOrigin(0.5).setAlpha(0);
                    container.add(ratingText);

                    // Card icon (top-left) — small filled rectangle that looks
                    // like a card. Yellow → 0xFACC15, red → 0xEF4444.
                    const cardIcon = this.scene.add.rectangle(-13, -radius - 5, 7, 10, 0xFACC15)
                        .setStrokeStyle(0.8, 0x000000, 1)
                        .setAlpha(0);
                    container.add(cardIcon);

                    // Injury icon (bottom-right) — red cross built from two
                    // crossed rectangles so it reads as a medical "+".
                    const injuryV = this.scene.add.rectangle(12, radius, 2.5, 9, 0xEF4444)
                        .setStrokeStyle(0.4, 0xffffff, 1).setAlpha(0);
                    const injuryH = this.scene.add.rectangle(12, radius, 9, 2.5, 0xEF4444)
                        .setStrokeStyle(0.4, 0xffffff, 1).setAlpha(0);
                    container.add(injuryV);
                    container.add(injuryH);

                    visual.element = container;
                    visual.staminaFill = stamFill;
                    visual.ratingBg    = ratingBg;
                    visual.ratingText  = ratingText;
                    visual.cardIcon    = cardIcon;
                    visual.injuryIcon  = { v: injuryV, h: injuryH };
                });
                return null;
            }

            // Live-update a player's rating badge (called from updateStats every
            // few ticks). Pass rating = 0 to hide the badge.
            updateRating(playerId, rating) {
                const v = this.playerVisuals[playerId];
                if (!v?.ratingBg || !v?.ratingText) return;
                if (!rating || rating <= 0) {
                    v.ratingBg.setAlpha(0);
                    v.ratingText.setAlpha(0);
                    return;
                }
                const c = rating < 5.5 ? 0xEF4444
                        : rating < 6.5 ? 0xFB923C
                        : rating < 7.5 ? 0xFACC15
                        : rating < 8.5 ? 0x22C55E
                        :                0x16A34A;
                v.ratingBg.fillColor = c;
                v.ratingBg.setAlpha(1);
                v.ratingText.setText(rating.toFixed(1));
                v.ratingText.setColor(rating < 6.5 ? '#ffffff' : '#111111');
                v.ratingText.setAlpha(1);
            }

            // Show / hide the card icon. kind = 'yellow' | 'red' | null.
            updateCardIcon(playerId, kind) {
                const v = this.playerVisuals[playerId];
                if (!v?.cardIcon) return;
                if (!kind) { v.cardIcon.setAlpha(0); return; }
                v.cardIcon.fillColor = (kind === 'red') ? 0xEF4444 : 0xFACC15;
                v.cardIcon.setAlpha(1);
            }

            // Show / hide the injury cross.
            updateInjuryIcon(playerId, on) {
                const v = this.playerVisuals[playerId];
                if (!v?.injuryIcon) return;
                const a = on ? 1 : 0;
                v.injuryIcon.v.setAlpha(a);
                v.injuryIcon.h.setAlpha(a);
            }

            // Live-update a player's stamina bar (called from updateStats each tick).
            updateStamina(playerId, stamina) {
                const v = this.playerVisuals[playerId];
                if (!v || !v.staminaFill) return;
                const pct = Math.max(0, Math.min(100, stamina));
                v.staminaFill.width = (v.staminaWidth * pct) / 100;
                v.staminaFill.fillColor = pct < 30 ? 0xEF4444 :
                                          pct < 60 ? 0xFACC15 :
                                                     0x22C55E;
            }

            renderBall(x, y) {
                const coords = this.getPixelCoords(x, y);
                this._enqueue(() => {
                    const ball = this.scene.add.circle(coords.x, coords.y, 5, 0xffffff);
                    ball.setStrokeStyle(0.5, 0x000000);
                    this._ball = ball;

                    // Backwards-compat shim. MatchFlow._animBall reads / writes cx/cy via
                    // getAttribute / setAttribute on this object in a requestAnimationFrame
                    // loop — proxy directly to the Phaser sprite's x / y so the existing
                    // animation code keeps working untouched.
                    this.ballElement = {
                        _ball: ball,
                        getAttribute(attr) {
                            if (attr === 'cx') return this._ball.x;
                            if (attr === 'cy') return this._ball.y;
                            return null;
                        },
                        setAttribute(attr, val) {
                            const v = parseFloat(val);
                            if (attr === 'cx') this._ball.x = v;
                            else if (attr === 'cy') this._ball.y = v;
                        },
                        // Some code in MatchFlow used to call .remove() on SVG; no-op for Phaser
                        remove() {}
                    };
                });
            }

            updatePlayerPosition(playerId, x, y) {
                const visual = this.playerVisuals[playerId];
                if (!visual) return;
                const coords = this.getPixelCoords(x, y);
                if (visual.element) visual.element.setPosition(coords.x, coords.y);
                visual.x = coords.x;
                visual.y = coords.y;
                visual.pitchX = x;
                visual.pitchY = y;
            }
        }

        class AnimationEngine {
            constructor(pitchRenderer) {
                this.pitch    = pitchRenderer;
                this._cancels = new Map();
            }

            animateMove(playerId, fromX, fromY, toX, toY, duration = 400) {
                const prev = this._cancels.get(playerId);
                if (prev) prev();
                return new Promise(resolve => {
                    let dead = false;
                    let rafId = null;
                    this._cancels.set(playerId, () => {
                        dead = true;
                        if (rafId) cancelAnimationFrame(rafId);
                        this._cancels.delete(playerId);
                        resolve();
                    });
                    const start = performance.now();
                    const tick  = (now) => {
                        if (dead) return;
                        const t    = Math.min((now - start) / duration, 1);
                        const ease = this.easeInOutCubic(t);
                        this.pitch.updatePlayerPosition(playerId,
                            fromX + (toX - fromX) * ease,
                            fromY + (toY - fromY) * ease);
                        if (t < 1) {
                            rafId = requestAnimationFrame(tick);
                        } else {
                            this._cancels.delete(playerId);
                            resolve();
                        }
                    };
                    rafId = requestAnimationFrame(tick);
                });
            }

            easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
        }


        class AvatarGenerator {
            // Seeded RNG now lives in random.js — kept as a shim for backwards compatibility.
            static seededRandom(seed) { return Random.seeded(seed); }

            static shade(hex, pct) {
                const n = parseInt(hex.replace('#',''), 16), a = Math.round(2.55 * pct);
                const c = v => Math.min(255, Math.max(0, v + a));
                return '#' + ((1<<24)+(c(n>>16)<<16)+(c((n>>8)&0xFF)<<8)+c(n&0xFF)).toString(16).slice(1);
            }
            static lightenColor(color, factor) { return this.shade(color, factor); }

            static generateAvatar(seed, teamJersey = null) {
                const rng = this.seededRandom(seed);
                const pick = arr => arr[Math.floor(rng() * arr.length)];
                const skinTones  = ['#FCEBD5','#F5CBA7','#E8A87C','#C68642','#A0522D','#7B3F1E','#4A2010'];
                const hairColors = ['#111111','#3B1F0A','#6B3A2A','#8B4513','#C19A6B','#DAA520','#D4380D','#6A0DAD','#1a3a6a'];
                const hairStyles = ['short','curly','spiky','slicked','wavy','mohawk','afro','bald'];
                const eyeColors  = ['#3D1C02','#1C3A6E','#2D6A2D','#8B6914','#1a1a1a','#4A3728'];
                const jerseyColors = ['#CC0000','#1133CC','#EEEEEE','#111111','#DDCC00','#CC6600'];
                return {
                    skin:     pick(skinTones),
                    hair:     pick(hairColors),
                    hairStyle: pick(hairStyles),
                    eyes:     pick(eyeColors),
                    jersey:   teamJersey || pick(jerseyColors),
                    build:    pick(['slim','athletic','stocky']),
                    hasBeard: rng() > 0.52,
                    beardColor: pick(hairColors),
                    expr:     Math.floor(rng() * 3),
                };
            }

            // Composes the standard 100×100 avatar card: rounded background + full human
            // figure. Thin wrapper over drawBackground + drawFigure so callers that want
            // just the figure on a transparent ground can use createFigureSVG / drawFigure
            // directly (e.g. dropping a body onto a pitch scene).
            static createSVG(avatar, size = 100, jerseyOverride = null) {
                const draw = SVG().size(size, size).viewbox(0, 0, 100, 100);
                this.drawBackground(draw);
                this.drawFigure(avatar, draw, jerseyOverride);
                return draw.svg();
            }

            // Same as createSVG but without the card background — returns the human
            // figure (head, hair, face, neck, torso, arms) on a transparent canvas.
            static createFigureSVG(avatar, size = 100, jerseyOverride = null) {
                const draw = SVG().size(size, size).viewbox(0, 0, 100, 100);
                this.drawFigure(avatar, draw, jerseyOverride);
                return draw.svg();
            }

            // Head-and-neck portrait — no jersey, no arms, no card backdrop. The
            // viewbox is cropped tight around the face so the head appears much
            // bigger inside a small frame (used by the Clubhouse squad list).
            // Suitable for circular cropping via CSS (border-radius: 50%).
            static createHeadSVG(avatar, size = 44) {
                // Head ellipse sits at (50, 37) rx=17 ry=21 → spans y 16..58;
                // neck ends at y≈63. A 60×60 viewbox centred horizontally with
                // the face in the upper half gives a clean portrait crop.
                const draw = SVG().size(size, size).viewbox(20, 10, 60, 60);
                this.drawFigure(avatar, draw, null, { headOnly: true });
                return draw.svg();
            }

            // Paints the sky-blue gradient card backdrop (rounded rect, horizon line,
            // shadow ellipse) into the supplied SVG.js draw root. Independent of any
            // avatar data — used only by the standard card composition.
            static drawBackground(draw) {
                const bgGrad = draw.gradient('linear', add => {
                    add.stop(0,    '#cce8f8');
                    add.stop(0.55, '#9ecae8');
                    add.stop(1,    '#6ea8d0');
                }).from(0, 0).to(0, 1);

                draw.rect(100, 100).fill(bgGrad).radius(8);
                draw.line(0, 75, 100, 75).stroke({ color: 'rgba(255,255,255,0.12)', width: 0.5 });
                draw.ellipse(80, 24).center(50, 100).fill('rgba(0,0,0,0.12)');
            }

            // Paints the human figure (arms, jersey, neck, ears, head + shading, hair,
            // eyebrows, eyes, nose, mouth, beard) into the supplied SVG.js draw root,
            // positioned in the standard 0–100 viewbox: head at (50, 37), shoulders
            // at y≈63, jersey extends to y=100. Gradients are scoped to `draw`.
            // No background drawn — caller is responsible for the canvas / backdrop.
            //
            // opts.headOnly — skip arms + jersey body (still paints the neck). Used by
            // createHeadSVG for portrait-style avatars in compact lists.
            static drawFigure(avatar, draw, jerseyOverride = null, opts = {}) {
                const sk  = avatar.skin;
                const skD = this.shade(sk, -20);
                const skL = this.shade(sk,  18);
                const jer = jerseyOverride || avatar.jersey;
                const jerD = this.shade(jer, -28);
                const jerL = this.shade(jer,  22);

                const bw = avatar.build === 'slim' ? 36 : avatar.build === 'stocky' ? 50 : 43;
                const bx = 50 - bw / 2;
                const hcx = 50, hcy = 37, hrx = 17, hry = 21;
                const topY = hcy - hry;

                // ── Figure-scoped gradients (auto-added to <defs> by SVG.js) ──
                const hdGrad = draw.gradient('linear', add => {
                    add.stop(0, skL); add.stop(1, skD);
                }).from(0.25, 0).to(1, 1);

                // Jersey gradients are only needed when we're actually painting
                // jersey + arms — head-only portraits skip the cost.
                let jrGrad = null, jrvGrad = null;
                if (!opts.headOnly) {
                    jrGrad = draw.gradient('linear', add => {
                        add.stop(0,    jerD);
                        add.stop(0.25, jer);
                        add.stop(0.75, jer);
                        add.stop(1,    jerD);
                    }).from(0, 0).to(1, 0);
                    jrvGrad = draw.gradient('linear', add => {
                        add.stop(0, jerL, 0.4);
                        add.stop(1, jerD, 0.3);
                    }).from(0, 0).to(0, 1);

                    // ── Arms ───────────────────────────────────────────────────
                    draw.path(`M${bx+4},65 L${bx-13},72 L${bx-14},94 L${bx+4},90 Z`).fill(jrGrad);
                    draw.path(`M${bx+bw-4},65 L${bx+bw+13},72 L${bx+bw+14},94 L${bx+bw-4},90 Z`).fill(jrGrad);
                    draw.ellipse(9, 6).center(bx-11, 95).fill(sk).opacity(0.9);
                    draw.ellipse(9, 6).center(bx+bw+11, 95).fill(sk).opacity(0.9);

                    // ── Jersey body ────────────────────────────────────────────
                    draw.path(`M${bx},63 Q50,60 ${bx+bw},63 L${bx+bw+5},100 L${bx-5},100 Z`).fill(jrGrad);
                    draw.path(`M${bx},63 Q50,60 ${bx+bw},63 L${bx+bw+5},100 L${bx-5},100 Z`).fill(jrvGrad);
                    draw.path(`M${bx},63 L${bx+7},63 L${bx+3},100 L${bx-5},100 Z`).fill('rgba(0,0,0,0.08)');
                    draw.path(`M${bx+bw},63 L${bx+bw-7},63 L${bx+bw-3},100 L${bx+bw+5},100 Z`).fill('rgba(0,0,0,0.08)');

                    draw.polygon(`${50-8},63 50,73 ${50+8},63`).fill(jerD);
                    draw.polygon(`${50-6},63 50,71 ${50+6},63`).fill(sk).opacity(0.15);

                    draw.path(`M${bx},63 Q${bx+5},61 ${bx+14},63`).fill('none').stroke({ color: jerL, width: 1.2, opacity: 0.55 });
                    draw.path(`M${bx+bw},63 Q${bx+bw-5},61 ${bx+bw-14},63`).fill('none').stroke({ color: jerL, width: 1.2, opacity: 0.55 });
                }

                // ── Neck ───────────────────────────────────────────────────
                draw.path(`M45,55 Q50,53 55,55 L55.5,63 Q50,61 44.5,63 Z`).fill(sk);
                draw.path(`M45,55 Q47,53 50,54 L50,63 Q47,62 44.5,63 Z`).fill('rgba(0,0,0,0.07)');

                // ── Ears ───────────────────────────────────────────────────
                draw.ellipse(8, 10).center(hcx-hrx+1, hcy+4).fill(sk);
                draw.ellipse(8, 10).center(hcx+hrx-1, hcy+4).fill(sk);
                draw.ellipse(4.4, 6).center(hcx-hrx+1, hcy+4).fill(skD).opacity(0.35);
                draw.ellipse(4.4, 6).center(hcx+hrx-1, hcy+4).fill(skD).opacity(0.35);

                // ── Head + shading ─────────────────────────────────────────
                draw.ellipse(hrx*2, hry*2).center(hcx, hcy).fill(hdGrad);
                draw.ellipse(24, 12).center(hcx, hcy+13).fill(skD).opacity(0.18);
                draw.ellipse(14, 9).center(hcx-4, topY+6).fill(skL).opacity(0.3);
                draw.ellipse(10, 7).center(hcx-10, hcy+7).fill('rgba(230,100,80,0.15)');
                draw.ellipse(10, 7).center(hcx+10, hcy+7).fill('rgba(230,100,80,0.15)');

                // ── Hair (delegates to drawHair, passing the draw root) ────
                this.drawHair(avatar, hcx, hcy, hrx, hry, draw);

                // ── Eyebrows ───────────────────────────────────────────────
                const browC = (avatar.hair === '#DAA520' || avatar.hair === '#C19A6B') ? '#7a5800' : this.shade(avatar.hair, -10);
                const browY = hcy - 9;
                const brow = (d) => draw.path(d).fill('none').stroke({ color: browC, width: 1.5, linecap: 'round' });
                if (avatar.expr === 2) {
                    brow(`M41,${browY+1} Q44.5,${browY-2} 48,${browY+0.5}`);
                    brow(`M52,${browY+0.5} Q55.5,${browY-2} 59,${browY+1}`);
                } else {
                    brow(`M41,${browY} Q44.5,${browY-2.5} 48,${browY}`);
                    brow(`M52,${browY} Q55.5,${browY-2.5} 59,${browY}`);
                }

                // ── Eyes ───────────────────────────────────────────────────
                const ey = hcy - 3;
                const drawEye = (cx) => {
                    draw.ellipse(8.4, 6.8).center(cx, ey).fill('white');
                    draw.circle(5.4).center(cx, ey).fill(avatar.eyes);
                    draw.circle(3.2).center(cx, ey).fill('#0d0d0d');
                    draw.circle(1.8).center(cx+1.4, ey-1.1).fill('white');
                    draw.path(`M${cx-4.2},${ey-2.8} Q${cx},${ey-5} ${cx+4.2},${ey-2.8}`).fill('none').stroke({ color: skD, width: 0.8, opacity: 0.6 });
                };
                drawEye(43);
                drawEye(57);

                // ── Nose ───────────────────────────────────────────────────
                const ny = hcy + 7;
                draw.path(`M50,${ny-5} C50,${ny-2} 47.5,${ny+1} 47,${ny+2} M50,${ny-5} C50,${ny-2} 52.5,${ny+1} 53,${ny+2}`).fill('none').stroke({ color: skD, width: 0.85, opacity: 0.5, linecap: 'round' });
                draw.path(`M47,${ny+2} Q50,${ny+3.5} 53,${ny+2}`).fill('none').stroke({ color: skD, width: 0.75, opacity: 0.45 });

                // ── Mouth ──────────────────────────────────────────────────
                const my = hcy + 14;
                const lipC = this.shade(sk, -38);
                if (avatar.expr === 0) {
                    draw.path(`M44,${my} Q50,${my+6} 56,${my}`).fill('none').stroke({ color: lipC, width: 1.2, linecap: 'round' });
                    draw.path(`M44.5,${my+0.5} Q50,${my+5.5} 55.5,${my+0.5}`).fill('rgba(160,40,40,0.3)');
                    draw.path(`M45.5,${my+1} Q50,${my+3.5} 54.5,${my+1}`).fill('rgba(255,255,255,0.35)');
                } else if (avatar.expr === 1) {
                    draw.path(`M44,${my+2} Q50,${my+4} 56,${my+2}`).fill('none').stroke({ color: lipC, width: 1.1, linecap: 'round' });
                    draw.path(`M44.5,${my+2} Q50,${my+3.5} 55.5,${my+2}`).fill('rgba(160,40,40,0.2)');
                } else {
                    draw.path(`M44,${my+3.5} Q50,${my+2} 56,${my+3.5}`).fill('none').stroke({ color: lipC, width: 1.1, linecap: 'round' });
                }

                // ── Beard / stubble ────────────────────────────────────────
                if (avatar.hasBeard) {
                    const bc = avatar.beardColor;
                    draw.path(`M35,${hcy+11} Q50,${hcy+25} 65,${hcy+11} Q63,${hcy+20} 50,${hcy+24} Q37,${hcy+20} 35,${hcy+11} Z`).fill(bc).opacity(0.20);
                    draw.path(`M37,${hcy+9} Q50,${hcy+22} 63,${hcy+9} Q61,${hcy+17} 50,${hcy+21} Q39,${hcy+17} 37,${hcy+9} Z`).fill(bc).opacity(0.12);
                    draw.path(`M45.5,${my-1} Q50,${my+1} 54.5,${my-1}`).fill('none').stroke({ color: bc, width: 1.1, opacity: 0.35 });
                }
            }

            // Adds hair shapes to the supplied SVG.js draw root. Same geometry as before.
            // (Returns void — the old string-returning shape isn't needed any more.)
            static drawHair(avatar, cx, cy, rx, ry, draw) {
                const hair = avatar.hair;
                const hL   = this.shade(hair, 20);
                const topY = cy - ry;

                switch (avatar.hairStyle) {
                    case 'short': {
                        draw.path(`M${cx-rx},${cy-5} Q${cx-rx+2},${topY-3} ${cx},${topY-4} Q${cx+rx-2},${topY-3} ${cx+rx},${cy-5} Q${cx+rx},${cy-14} ${cx},${topY-5} Q${cx-rx},${cy-14} ${cx-rx},${cy-5} Z`).fill(hair);
                        draw.ellipse(12, 7).center(cx-2, topY+3).fill(hL).opacity(0.3);
                        break;
                    }
                    case 'curly': {
                        draw.ellipse((rx+4)*2, 28).center(cx, topY+7).fill(hair);
                        for (let i = 0; i < 13; i++) {
                            const a = (i/13)*Math.PI*2;
                            const r2 = rx + 3 + Math.sin(i*2.3)*1.5;
                            const px = +(cx + Math.cos(a)*r2).toFixed(1);
                            const py = +(cy-10 + Math.sin(a)*10).toFixed(1);
                            draw.circle(7.6).center(px, py).fill(hair);
                        }
                        draw.ellipse(10, 6).center(cx-3, topY).fill(hL).opacity(0.22);
                        break;
                    }
                    case 'spiky': {
                        draw.ellipse(rx*2, 18).center(cx, topY+7).fill(hair);
                        const spikes = [[-9,13],[-5,18],[-1,21],[3,19],[7,15],[11,10]];
                        spikes.forEach(([ox, ht]) => {
                            const base = topY + 6;
                            draw.polygon(`${cx+ox-3},${base} ${cx+ox+1},${base-ht} ${cx+ox+4},${base}`).fill(hair);
                        });
                        draw.ellipse(8, 5).center(cx+1, topY+2).fill(hL).opacity(0.28);
                        break;
                    }
                    case 'slicked': {
                        draw.path(`M${cx-rx},${cy-6} Q${cx-rx+2},${topY-2} ${cx-4},${topY-3} Q${cx+rx-4},${topY-2} ${cx+rx},${cy-4} L${cx+rx-1},${cy-1} Q${cx+rx-4},${topY+3} ${cx-1},${topY+1} Q${cx-rx+3},${topY+3} ${cx-rx},${cy-4} Z`).fill(hair);
                        draw.path(`M${cx-3},${cy-7} Q${cx-1},${topY-1} ${cx+6},${topY+1}`).fill('none').stroke({ color: hL, width: 1.4, opacity: 0.35, linecap: 'round' });
                        break;
                    }
                    case 'wavy': {
                        draw.path(`M${cx-rx},${cy-5} Q${cx-rx+1},${topY-1} ${cx-8},${topY-5} Q${cx},${topY-8} ${cx+8},${topY-5} Q${cx+rx-1},${topY-1} ${cx+rx},${cy-5} L${cx+rx},${cy-2} Q${cx+rx-2},${topY+2} ${cx+6},${topY-2} Q${cx},${topY-5} ${cx-6},${topY-2} Q${cx-rx+2},${topY+2} ${cx-rx},${cy-2} Z`).fill(hair);
                        draw.path(`M${cx-10},${cy-8} Q${cx-5},${topY-3} ${cx+2},${topY-5}`).fill('none').stroke({ color: hL, width: 1.5, opacity: 0.3, linecap: 'round' });
                        break;
                    }
                    case 'mohawk': {
                        draw.path(`M${cx-4},${cy-12} Q${cx-3},${topY-8} ${cx},${topY-12} Q${cx+3},${topY-8} ${cx+4},${cy-12} L${cx+3},${cy-4} Q${cx},${cy-2} ${cx-3},${cy-4} Z`).fill(hair);
                        for (let i = 0; i < 5; i++) {
                            const py = cy-12+i*2.5;
                            draw.line(cx-2.5, py, cx+2.5, py-3).stroke({ color: hL, width: 0.7, opacity: 0.4 });
                        }
                        break;
                    }
                    case 'afro': {
                        draw.ellipse((rx+6)*2, 40).center(cx, topY+5).fill(hair);
                        for (let i = 0; i < 16; i++) {
                            const a = (i/16)*Math.PI*2;
                            const r2 = rx+5+Math.sin(i*1.9)*2.5;
                            const px = +(cx + Math.cos(a)*r2).toFixed(1);
                            const py = +(topY+5 + Math.sin(a)*17).toFixed(1);
                            draw.circle(8.4).center(px, py).fill(hair);
                        }
                        draw.ellipse(12, 8).center(cx-5, topY-4).fill(hL).opacity(0.2);
                        break;
                    }
                    case 'bald':
                    default: {
                        draw.ellipse(rx*2, 18).center(cx, topY+7).fill(hair).opacity(0.09);
                        break;
                    }
                }
            }
        }

        class CrestGenerator {
            // Seeded RNG shared with AvatarGenerator — lives in random.js.
            static _rng(seed) { return Random.seeded(seed); }

            static _lum(hex) {
                const n = parseInt(hex.replace('#',''), 16);
                return ((n>>16)&255)*0.299 + ((n>>8)&255)*0.587 + (n&255)*0.114;
            }

            // Pick a heraldic emblem for this crest. Tries to match the team name's noun
            // (Lions → lion, Eagles → eagle, etc.); falls back to a seeded random from the
            // full catalog for nouns without a creature match (City / Albion / Dynamo / …).
            static _pickEmblem(seed, name) {
                const lower = (name || '').toLowerCase();
                if (lower.includes('lion'))    return 'lion';
                if (lower.includes('tiger'))   return 'lion';      // big-cat silhouette covers both
                if (lower.includes('eagle'))   return 'eagle';
                if (lower.includes('falcon'))  return 'eagle';
                if (lower.includes('wolf') || lower.includes('wolves')) return 'wolf';
                if (lower.includes('dragon'))  return 'dragon';
                if (lower.includes('knight') || lower.includes('royal')) return 'crown';
                if (lower.includes('fire') || lower.includes('thunder') || lower.includes('storm')) return 'phoenix';
                if (lower.includes('rose'))    return 'rose';
                const all = ['lion','eagle','wolf','dragon','phoenix','rose','fleur','crown','star'];
                const rng = this._rng(seed + 700);
                return all[Math.floor(rng() * all.length)];
            }

            // Returns SVG markup for the chosen emblem, sized + positioned to sit in the
            // upper portion of the shield (centered roughly at (50, 32), fits in ~24×24).
            // Gold (acc) is the main fill; primaryColor is reused for inner cutouts so
            // features (eyes / beak / face) show against the surrounding gold and pick up
            // contrast with the shield's main hue.
            static _emblemSVG(kind, primaryColor, acc) {
                const E = {
                    lion: `<g fill="${acc}">
                        <polygon points="50,18 52,22 56,21 56,25 60,26 58,29 62,31 58,33 60,36 56,37 56,41 52,40 50,44 48,40 44,41 44,37 40,36 42,33 38,31 42,29 40,26 44,25 44,21 48,22"/>
                        <ellipse cx="50" cy="31" rx="5" ry="6" fill="${primaryColor}"/>
                        <circle cx="44.5" cy="26" r="1.4"/>
                        <circle cx="55.5" cy="26" r="1.4"/>
                        <circle cx="47.5" cy="30" r="0.7"/>
                        <circle cx="52.5" cy="30" r="0.7"/>
                        <polygon points="49,33 51,33 50,34.5"/>
                        <path d="M48,35 Q50,37 52,35" fill="none" stroke="${acc}" stroke-width="0.6"/>
                    </g>`,
                    eagle: `<g fill="${acc}">
                        <ellipse cx="50" cy="34" rx="2.5" ry="6"/>
                        <path d="M48,32 Q40,25 36,33 Q44,30 48,35 Z"/>
                        <path d="M52,32 Q60,25 64,33 Q56,30 52,35 Z"/>
                        <circle cx="50" cy="25" r="2.5"/>
                        <polygon points="49,27 51,27 50,28.5" fill="${primaryColor}"/>
                        <polygon points="48,40 52,40 50,44"/>
                        <circle cx="50.6" cy="24.5" r="0.4" fill="${primaryColor}"/>
                    </g>`,
                    wolf: `<g fill="${acc}">
                        <polygon points="42,22 46,29 49,28 51,28 54,29 58,22 57,30 60,33 58,38 54,40 46,40 42,38 40,33 43,30"/>
                        <circle cx="47.5" cy="32" r="0.7" fill="${primaryColor}"/>
                        <circle cx="52.5" cy="32" r="0.7" fill="${primaryColor}"/>
                        <polygon points="49,35 51,35 50,37" fill="${primaryColor}"/>
                    </g>`,
                    dragon: `<g fill="${acc}">
                        <polygon points="42,20 46,26 47,22"/>
                        <polygon points="58,20 54,26 53,22"/>
                        <path d="M43,26 L47,25 L53,25 L57,26 L60,30 L60,34 L57,38 L43,38 L40,34 L40,30 Z"/>
                        <polygon points="46,38 54,38 56,42 44,42"/>
                        <circle cx="47" cy="30" r="1.1" fill="${primaryColor}"/>
                        <circle cx="53" cy="30" r="1.1" fill="${primaryColor}"/>
                        <circle cx="47" cy="30" r="0.4"/>
                        <circle cx="53" cy="30" r="0.4"/>
                        <polygon points="48,42 47.5,44 47,42" fill="${primaryColor}"/>
                        <polygon points="52,42 52.5,44 53,42" fill="${primaryColor}"/>
                    </g>`,
                    phoenix: `<g fill="${acc}">
                        <ellipse cx="50" cy="30" rx="2" ry="5"/>
                        <circle cx="50" cy="23" r="2"/>
                        <polygon points="49,25 51,25 50,27" fill="${primaryColor}"/>
                        <path d="M48,27 Q42,18 40,26 Q45,25 48,32 Z"/>
                        <path d="M52,27 Q58,18 60,26 Q55,25 52,32 Z"/>
                        <polygon points="46,35 47.5,42 49,36 50,42 51,36 52.5,42 54,35"/>
                    </g>`,
                    rose: `<g fill="${acc}">
                        <ellipse cx="50" cy="24" rx="3" ry="5"/>
                        <ellipse cx="50" cy="40" rx="3" ry="5"/>
                        <ellipse cx="45" cy="27.5" rx="5" ry="3" transform="rotate(-60 45 27.5)"/>
                        <ellipse cx="55" cy="27.5" rx="5" ry="3" transform="rotate(60 55 27.5)"/>
                        <ellipse cx="45" cy="36.5" rx="5" ry="3" transform="rotate(60 45 36.5)"/>
                        <ellipse cx="55" cy="36.5" rx="5" ry="3" transform="rotate(-60 55 36.5)"/>
                        <circle cx="50" cy="32" r="3" fill="${primaryColor}"/>
                        <circle cx="50" cy="32" r="1.4"/>
                    </g>`,
                    fleur: `<g fill="${acc}">
                        <path d="M50,20 Q47,28 49,32 L51,32 Q53,28 50,20 Z"/>
                        <path d="M49,32 Q41,28 41,38 Q47,35 50,32 Z"/>
                        <path d="M51,32 Q59,28 59,38 Q53,35 50,32 Z"/>
                        <rect x="42" y="33.5" width="16" height="2.5"/>
                        <polygon points="47,36 53,36 50,42"/>
                    </g>`,
                    crown: `<g fill="${acc}">
                        <polygon points="40,34 40,28 44,30 47,25 50,29 53,25 56,30 60,28 60,34"/>
                        <rect x="40" y="34" width="20" height="5"/>
                        <circle cx="47" cy="25.5" r="0.8" fill="${primaryColor}"/>
                        <circle cx="50" cy="28" r="0.8" fill="${primaryColor}"/>
                        <circle cx="53" cy="25.5" r="0.8" fill="${primaryColor}"/>
                        <circle cx="45" cy="36.5" r="0.6" fill="${primaryColor}"/>
                        <circle cx="50" cy="36.5" r="0.6" fill="${primaryColor}"/>
                        <circle cx="55" cy="36.5" r="0.6" fill="${primaryColor}"/>
                    </g>`,
                    star: `<polygon points="50,21 52.4,28.5 60.5,28.5 53.9,33.2 56.4,40.7 50,36 43.6,40.7 46.1,33.2 39.5,28.5 47.6,28.5" fill="${acc}"/>`,
                };
                return E[kind] || E.star;
            }

            static generateName(seed) {
                const rng = this._rng(seed);
                const adjs  = ['Royal','Athletic','Sporting','Golden','Iron','Thunder','Storm','Noble','Swift','Fire','Red','Blue','Black','Brave','United'];
                const nouns = ['Lions','Eagles','Tigers','Wolves','Falcons','Dragons','Knights','Rovers','Rangers','Wanderers','Albion','Dynamo','City','Victoria','Strikers'];
                const sfxs  = ['FC','AFC','SC','CF',''];
                const adj  = adjs [Math.floor(rng() * adjs.length)];
                const noun = nouns[Math.floor(rng() * nouns.length)];
                const sfx  = sfxs [Math.floor(rng() * sfxs.length)];
                return (sfx ? `${adj} ${noun} ${sfx}` : `${adj} ${noun}`).trim();
            }

            static generateSVG(seed, primaryColor, size = 70) {
                const rng = this._rng(seed + 500);
                const h   = Math.round(size * 1.2);
                const sec = this._lum(primaryColor) > 140 ? '#1a1a2e' : '#FFFFFF';
                const acc = '#FFD700';
                const designs = ['halves','quarters','stripes','chevron','diagonal','cross','plain'];
                const design  = designs[Math.floor(rng() * designs.length)];
                const name    = this.generateName(seed);
                const initials = name.split(' ').filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0,3);
                const uid = `cr${seed}_${Math.random().toString(36).slice(2,7)}`;
                const shield = 'M50,5 L95,20 L95,75 Q95,108 50,118 Q5,108 5,75 L5,20 Z';
                const inner  = 'M50,12 L88,25 L88,73 Q88,102 50,111 Q12,102 12,73 L12,25 Z';
                // Everything painted inside the shield (design pattern, inner accent,
                // star, initials) goes through this clip so nothing can poke past the
                // shield outline — wide letters in the initials and the gold inner-accent
                // stroke used to bleed at the curved bottom.
                let s = `<svg width="${size}" height="${h}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">`;
                s += `<defs><clipPath id="${uid}"><path d="${shield}"/></clipPath></defs>`;
                // Shadow — offset by (2,2) so it stays within the viewBox bottom (y≤120).
                s += `<path d="${shield}" fill="rgba(0,0,0,0.22)" transform="translate(2,2)"/>`;
                s += `<path d="${shield}" fill="${primaryColor}"/>`;
                s += `<g clip-path="url(#${uid})">`;
                if (design==='halves')   s += `<rect x="50" y="0" width="50" height="120" fill="${sec}" opacity="0.85"/>`;
                else if (design==='quarters') { s += `<rect x="50" y="0" width="50" height="62" fill="${sec}" opacity="0.85"/>`; s += `<rect x="0" y="62" width="50" height="58" fill="${sec}" opacity="0.85"/>`; }
                else if (design==='stripes')  { s += `<rect x="20" y="0" width="20" height="120" fill="${sec}" opacity="0.85"/>`; s += `<rect x="60" y="0" width="20" height="120" fill="${sec}" opacity="0.85"/>`; }
                else if (design==='chevron')   s += `<polygon points="0,52 50,88 100,52 100,72 50,108 0,72" fill="${sec}" opacity="0.85"/>`;
                else if (design==='diagonal')  s += `<polygon points="0,0 65,0 100,50 100,120 35,120 0,70" fill="${sec}" opacity="0.72"/>`;
                else if (design==='cross')    { s += `<rect x="40" y="0" width="20" height="120" fill="${sec}" opacity="0.8"/>`; s += `<rect x="0" y="44" width="100" height="22" fill="${sec}" opacity="0.8"/>`; }
                s += `<path d="${inner}"  fill="none" stroke="${acc}" stroke-width="1.5" opacity="0.65"/>`;
                s += this._emblemSVG(this._pickEmblem(seed, name), primaryColor, acc);
                const fs = initials.length <= 2 ? 27 : 20;
                s += `<text x="50" y="77" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${fs}" fill="${acc}" stroke="rgba(0,0,0,0.55)" stroke-width="2" paint-order="stroke">${initials}</text>`;
                s += `</g>`;
                // Outer stroke is drawn LAST so it crisply outlines the shield over the
                // clipped contents. Unclipped on purpose — clipping it would shave the
                // outer half of the stroke and make the outline look thinner.
                s += `<path d="${shield}" fill="none" stroke="${acc}" stroke-width="3"/>`;
                s += `</svg>`;
                return s;
            }
        }

        const NATIONS = [
            { flag: '🇧🇷', name: 'Brazil',       weight: 8,
              first: ['Gabriel','Lucas','Matheus','Bruno','Vinicius','Raphael','Thiago','Eduardo','Gustavo','Felipe','Anderson','Willian','Roberto','Fernando','Leandro'],
              last:  ['Silva','Santos','Souza','Oliveira','Costa','Pereira','Lima','Alves','Barbosa','Ferreira','Carvalho','Ribeiro','Gomes','Martins','Rocha'] },
            { flag: '🇪🇸', name: 'Spain',        weight: 7,
              first: ['Carlos','Sergio','Álvaro','Pedro','Marco','Dani','Jordi','Pedri','Ferran','Mikel','Xavi','Andrés','David','Raúl','Pablo'],
              last:  ['García','López','Martínez','Fernández','Sánchez','Pérez','Rodríguez','Ramos','Alba','Torres','Villa','Moreno','Navarro','Ruiz','Iglesias'] },
            { flag: '🇫🇷', name: 'France',       weight: 8,
              first: ['Kylian','Antoine','Paul','Olivier','Ousmane','Raphaël','Theo','Marcus','Benjamin','Lucas','Jules','Clément','Adrien','Kingsley','Wissam'],
              last:  ['Dupont','Martin','Bernard','Thomas','Petit','Dubois','Laurent','Simon','Michel','Lefebvre','Leroy','Moreau','Blanc','Giroud','Lloris'] },
            { flag: '🇩🇪', name: 'Germany',      weight: 6,
              first: ['Thomas','Kai','Leon','Jonas','Florian','Timo','Serge','Jamal','Marco','Ilkay','Joshua','Leroy','Robin','Niklas','Manuel'],
              last:  ['Müller','Schmidt','Fischer','Weber','Schulz','Wagner','Becker','Wolf','Richter','Kroos','Kimmich','Gnabry','Rüdiger','Werner','Neuer'] },
            { flag: '🇦🇷', name: 'Argentina',    weight: 7,
              first: ['Rodrigo','Nicolás','Joaquín','Paulo','Ángel','Leandro','Gonzalo','Sergio','Emiliano','Lautaro','Julián','Alejandro','Federico','Roberto','Marcos'],
              last:  ['Fernández','González','Martínez','López','Pérez','Sánchez','Romero','Gómez','Díaz','Rodríguez','Álvarez','Otamendi','Molina','Acuña','Palacio'] },
            { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'England',      weight: 7,
              first: ['Harry','Marcus','Phil','Bukayo','Jude','Jack','Jordan','Declan','Mason','Raheem','Kieran','Luke','Trent','Kalvin','Ben'],
              last:  ['Smith','Jones','Williams','Brown','Taylor','Davies','Wilson','Evans','Walker','Shaw','Pickford','Maguire','Rice','Henderson','Kane'] },
            { flag: '🇮🇹', name: 'Italy',        weight: 6,
              first: ['Marco','Federico','Lorenzo','Nicolò','Leonardo','Giacomo','Ciro','Andrea','Matteo','Alessandro','Gianluca','Davide','Roberto','Francesco','Sandro'],
              last:  ['Rossi','Ferrari','Bianchi','Esposito','Ricci','Marino','Greco','Bruno','Gallo','Conti','Verratti','Barella','Pellegrini','Donnarumma','Chiesa'] },
            { flag: '🇵🇹', name: 'Portugal',     weight: 6,
              first: ['Bruno','Bernardo','João','Rafael','Diogo','Rúben','Pedro','André','Nuno','Ricardo','Luís','Renato','Danilo','Gonçalo','José'],
              last:  ['Silva','Santos','Pereira','Costa','Fernandes','Mendes','Rodrigues','Sousa','Lopes','Dias','Neves','Moutinho','Guerreiro','Cancelo','Carvalho'] },
            { flag: '🇳🇱', name: 'Netherlands',  weight: 5,
              first: ['Virgil','Memphis','Frenkie','Cody','Donny','Davy','Matthijs','Georginio','Ryan','Teun','Donyell','Quincy','Arjen','Robin','Wesley'],
              last:  ['van Dijk','Depay','de Jong','Gakpo','van de Beek','Klaassen','de Ligt','Wijnaldum','Gravenberch','Koopmeiners','Malen','Promes','Robben','van Persie','Sneijder'] },
            { flag: '🇻🇳', name: 'Vietnam',      weight: 15, format: 'last_first',
              // Vietnamese names are typically HỌ + TÊN ĐỆM + TÊN (last + middle + first).
              // ~75% of players get a middle name; pool is male-leaning since these are footballers.
              middleProb: 0.75,
              middle: ['Văn','Đức','Hữu','Công','Quốc','Bá','Trọng','Xuân','Hoàng','Minh','Phú','Quang','Anh','Tuấn','Đình','Ngọc','Chí','Thế','Mạnh','Khánh'],
              first: ['Minh','Quang','Hùng','Tuấn','Dũng','Khoa','Nam','Đức','Long','Tùng','Hải','Anh','Phong','Bảo','Kiên','Thành','Trọng','Tiến','Công','Vũ'],
              last:  ['Nguyễn','Trần','Lê','Phạm','Hoàng','Phan','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh'] },
            { flag: '🇸🇳', name: 'Senegal',      weight: 5,
              first: ['Sadio','Ismaila','Cheikhou','Idrissa','Bamba','Mbaye','Pape','Saliou','Lamine','Alfred','Abdou','Souleymane','Krepin','El Hadji','Formose'],
              last:  ['Mané','Sarr','Kouyaté','Gueye','Dieng','Niang','Cissé','Diallo','Camara','Diouf','Ndoye','Diatta','Badji','Sow','Dembélé'] },
            { flag: '🇳🇬', name: 'Nigeria',      weight: 5,
              first: ['Victor','Kelechi','Alex','Samuel','Emmanuel','Taiwo','Terem','Cyriel','John','Sunday','Kenneth','Oghenekaro','Stanley','Peter','Wilfried'],
              last:  ['Osimhen','Iheanacho','Iwobi','Onana','Chukwueze','Awoniyi','Moffi','Dessers','Obi','Okoye','Omeruo','Etebo','Ndidi','Aribo','Ejuke'] },
            { flag: '🇯🇵', name: 'Japan',        weight: 5,
              first: ['Takumi','Kaoru','Ritsu','Junya','Daichi','Hidemasa','Wataru','Yuya','Shunsuke','Takehiro','Yuto','Gaku','Ayase','Shuto','Keito'],
              last:  ['Minamino','Mitoma','Doan','Ito','Kamada','Morita','Endo','Itakura','Kubo','Nagatomo','Tomiyasu','Ueda','Machino','Nakamura','Hashioka'] },
            { flag: '🇰🇷', name: 'South Korea',  weight: 4,
              first: ['Heung-min','Ui-jo','Jae-sung','Min-jae','Woo-yeong','Tae-young','Dong-jun','Hyun-ju','Chang-hoon','Kang-in','In-beom','Seung-ho','Min-joon','Jun-ho','Kyung-hee'],
              last:  ['Son','Hwang','Lee','Kim','Jung','Park','Cho','Shin','Yoon','Han','Na','Kwon','Lim','Oh','Bae'] },
            { flag: '🇲🇽', name: 'Mexico',       weight: 5,
              first: ['Hirving','Raúl','Alexis','Héctor','Guillermo','Carlos','Edson','Miguel','Roberto','Jesús','Andrés','Orbelin','Luis','Rodolfo','César'],
              last:  ['Lozano','Jiménez','Vega','Moreno','Ochoa','Acevedo','Álvarez','Layún','Alvarado','Corona','Guardado','Pineda','Reyes','Pizarro','Montes'] },
            { flag: '🇨🇴', name: 'Colombia',     weight: 5,
              first: ['James','Radamel','Juan','Davinson','Luis','Yerry','Wilmar','Miguel','Jhon','Carlos','Sebastián','Duván','Cristian','Marlos','Alfredo'],
              last:  ['Rodríguez','Falcao','Cuadrado','Sánchez','Muriel','Mina','Morelos','Barrios','Arias','Córdoba','Zapata','Díaz','Cuesta','Borja','Uribe'] },
        ];
        const _nationsTotal = NATIONS.reduce((s, n) => s + n.weight, 0);
        function pickNation() {
            let r = Math.random() * _nationsTotal;
            for (const n of NATIONS) { r -= n.weight; if (r <= 0) return n; }
            return NATIONS[0];
        }

        class Team {
            // Expected position for each starting-XI slot in each formation. Order matches the
            // slot order used by setupSquad/onField (slot 0 = GK, then defenders L→R, mids L→R,
            // forwards L→R). When a player is placed in a slot, their `position` is set to the
            // slot's expected position — `naturalPosition` is preserved. ZoneStrength.positionMult
            // then applies the out-of-position penalty automatically.
            static SLOT_POSITIONS = {
                '442': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
                '433': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'],
                '451': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CDM', 'CM', 'CAM', 'RM', 'ST'],
                '532': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CDM', 'CM', 'CAM', 'ST', 'ST'],
                '541': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'LM', 'CM', 'CM', 'RM', 'ST'],
                '352': ['GK', 'CB', 'CB', 'CB', 'LWB', 'CDM', 'CM', 'CAM', 'RWB', 'ST', 'ST'],
                '343': ['GK', 'CB', 'CB', 'CB', 'LM', 'CDM', 'CM', 'RM', 'LW', 'ST', 'RW'],
            };

            // Per-position "secondary-position pool" — when generating a player at natural
            // position X, 1–2 of these are picked as their secondary positions.
            static POSITION_SECONDARY_POOL = {
                GK:  [],                                          // dedicated keepers
                CB:  ['CDM', 'LB', 'RB'],
                CDM: ['CB', 'CM'],
                LB:  ['LWB', 'CB', 'LM'],
                RB:  ['RWB', 'CB', 'RM'],
                LWB: ['LB', 'LM'],
                RWB: ['RB', 'RM'],
                CM:  ['CDM', 'CAM', 'LM', 'RM'],
                CAM: ['CM', 'ST', 'CF'],
                LM:  ['LW', 'LB', 'LWB', 'CM'],
                RM:  ['RW', 'RB', 'RWB', 'CM'],
                LW:  ['LM', 'CF', 'ST'],
                RW:  ['RM', 'CF', 'ST'],
                ST:  ['CF', 'CAM'],
                CF:  ['ST', 'CAM'],
            };

            // Pick 1–2 secondary positions from the pool (50 % chance of having a 2nd).
            static randomSecondaries(naturalPos) {
                const pool = Team.POSITION_SECONDARY_POOL[naturalPos] || [];
                if (!pool.length) return [];
                const shuffled = Random.shuffle(pool);
                const count = Math.random() < 0.50 ? 2 : 1;
                return shuffled.slice(0, Math.min(count, pool.length));
            }

            // Realistic age distribution — Normal(25, 4), clamped to a professional career range.
            static randomAge() {
                return Random.gaussianInt(25, 4, 17, 38);
            }

            // Foot preference. Real-world distribution is roughly 75% right /
            // 18% left / 7% two-footed. Used by scenes that need to stand the
            // player on one side of the ball (e.g. free-kick positioning).
            static randomFoot() {
                const r = Math.random();
                if (r < 0.75) return 'right';
                if (r < 0.93) return 'left';
                return 'both';
            }

            // ─── Kit colour helpers ─────────────────────────────────────────
            // Hex ⇆ HSL conversion (small, no dependency).
            static _hexToHsl(hex) {
                const m = (hex || '').replace('#','').padStart(6,'0').match(/(..)(..)(..)/);
                if (!m) return { h: 0, s: 1, l: 0.5 };
                const r = parseInt(m[1],16)/255, g = parseInt(m[2],16)/255, b = parseInt(m[3],16)/255;
                const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
                let h = 0; const l = (mx+mn)/2; const d = mx-mn;
                const s = d === 0 ? 0 : d / (1 - Math.abs(2*l-1));
                if (d !== 0) {
                    if      (mx === r) h = 60 * (((g-b)/d) % 6);
                    else if (mx === g) h = 60 * (((b-r)/d) + 2);
                    else               h = 60 * (((r-g)/d) + 4);
                }
                if (h < 0) h += 360;
                return { h, s, l };
            }
            static _hslToHex(h, s, l) {
                const c = (1 - Math.abs(2*l-1)) * s;
                const x = c * (1 - Math.abs(((h/60) % 2) - 1));
                const m = l - c/2;
                let r=0,g=0,b=0;
                if      (h < 60)  { r=c; g=x; b=0; }
                else if (h < 120) { r=x; g=c; b=0; }
                else if (h < 180) { r=0; g=c; b=x; }
                else if (h < 240) { r=0; g=x; b=c; }
                else if (h < 300) { r=x; g=0; b=c; }
                else              { r=c; g=0; b=x; }
                const to = v => Math.max(0, Math.min(255, Math.round((v+m)*255))).toString(16).padStart(2,'0');
                return '#' + to(r) + to(g) + to(b);
            }
            // Derive a high-contrast away kit from the home colour.
            // Approach: rotate hue by 180° (complementary), keep saturation
            // strong, and flip lightness so a dark home → light away (and v.v.).
            // Steer clear of pitch-green hues (90°–150°).
            static computeAwayColor(homeHex) {
                const { h, l } = Team._hexToHsl(homeHex);
                let h2 = (h + 180) % 360;
                if (h2 >= 90 && h2 <= 150) h2 = (h2 + 60) % 360;
                const s2 = 0.85;
                const l2 = l < 0.45 ? 0.85 : l > 0.65 ? 0.18 : 0.22;
                return Team._hslToHex(h2, s2, l2);
            }
            // Two kits clash when they share roughly the same hue AND a similar
            // lightness — referees would force a kit change in real football.
            static colorsClash(hex1, hex2) {
                const a = Team._hexToHsl(hex1);
                const b = Team._hexToHsl(hex2);
                const dh = Math.abs(a.h - b.h);
                const hueDist = Math.min(dh, 360 - dh);
                const lDist   = Math.abs(a.l - b.l);
                return hueDist < 35 && lDist < 0.25;
            }

            // Position-aware height (cm) using a Normal distribution per role profile.
            // GKs / CBs / target STs trend tall; wide midfielders / wingers trend shorter.
            static randomHeight(position) {
                const profile = ({
                    GK:  { mean: 188, std: 5 },
                    CB:  { mean: 186, std: 5 },
                    ST:  { mean: 184, std: 6 },
                    CF:  { mean: 182, std: 6 },
                    CDM: { mean: 182, std: 5 },
                    CM:  { mean: 180, std: 5 },
                    LB:  { mean: 178, std: 4 },
                    RB:  { mean: 178, std: 4 },
                    LWB: { mean: 177, std: 4 },
                    RWB: { mean: 177, std: 4 },
                    CAM: { mean: 177, std: 5 },
                    LM:  { mean: 177, std: 5 },
                    RM:  { mean: 177, std: 5 },
                    LW:  { mean: 175, std: 5 },
                    RW:  { mean: 175, std: 5 },
                })[position] || { mean: 180, std: 5 };
                return Random.gaussianInt(profile.mean, profile.std, 160, 205);
            }

            // PES-style match-day morale (5 tiers). Bell-curve distribution biased toward 'normal'.
            // Order best → worst: top / good / normal / poor / terrible.
            static randomMorale() {
                const r = Math.random();
                if (r < 0.10) return 'top';        // 10 %
                if (r < 0.32) return 'good';       // 22 %
                if (r < 0.68) return 'normal';     // 36 %
                if (r < 0.90) return 'poor';       // 22 %
                return 'terrible';                  // 10 %
            }

            // CM 03/04-style individual player instructions, sensible defaults by position.
            // Mentality / Tackling / Passing default to 'default' meaning "follow team setting";
            // setting them to a concrete value overrides the team tactic for that player.
            static defaultInstructions(position) {
                const inst = {
                    forwardRuns:  'mixed',   // often | mixed | rarely
                    runWithBall:  'mixed',   // often | mixed | rarely
                    longShots:    'mixed',   // often | mixed | rarely
                    throughBalls: 'mixed',   // often | mixed | rarely
                    crossBall:    'mixed',   // often | mixed | rarely (wide players)
                    holdUpBall:   'no',      // yes | no (forwards)
                    tightMarking: 'no',      // yes | no (defenders / midfielders)
                    freeRole:     'no',      // yes | no
                    arrow:        null,      // null | 8 compass directions
                    // Per-player overrides of team tactics. 'default' = follow team.
                    mentality:    'default', // default | ultra-def | defensive | normal | attacking | gung-ho
                    tackling:     'default', // default | hard | normal | easy
                    passing:      'default', // default | direct | mixed | short
                };
                if (['ST','CF'].includes(position)) {
                    inst.forwardRuns = 'often'; inst.holdUpBall = 'yes'; inst.longShots = 'often';
                    inst.crossBall = 'rarely';
                } else if (['LW','RW'].includes(position)) {
                    inst.forwardRuns = 'often'; inst.runWithBall = 'often'; inst.crossBall = 'often';
                } else if (position === 'CAM') {
                    inst.forwardRuns = 'often'; inst.runWithBall = 'often'; inst.throughBalls = 'often';
                    inst.crossBall = 'rarely';
                } else if (['LM','RM'].includes(position)) {
                    inst.runWithBall = 'often'; inst.crossBall = 'often';
                } else if (['LWB','RWB'].includes(position)) {
                    inst.runWithBall = 'often'; inst.crossBall = 'often'; inst.tightMarking = 'yes';
                } else if (position === 'CM') {
                    inst.throughBalls = 'often';
                } else if (['LB','RB'].includes(position)) {
                    inst.forwardRuns = 'rarely'; inst.runWithBall = 'rarely'; inst.longShots = 'rarely';
                    inst.crossBall = 'mixed'; inst.tightMarking = 'yes';
                } else if (['CB','CDM'].includes(position)) {
                    inst.forwardRuns = 'rarely'; inst.runWithBall = 'rarely'; inst.longShots = 'rarely';
                    inst.tightMarking = 'yes';
                } else if (position === 'GK') {
                    inst.forwardRuns = 'rarely'; inst.runWithBall = 'rarely'; inst.longShots = 'rarely';
                }
                return inst;
            }

            // Back-fill the new CM 03/04-style fitness fields on legacy player
            // objects loaded from storage:
            //   - `condition`      → defaults to 100 (assume fresh-ish on load)
            //   - `naturalFitness` → derived from `stamina` ±8 if missing
            // Older saves had a single `stamina` field that doubled as both the
            // attribute AND the live drained value, so any value < ~50 likely
            // represents end-of-match fatigue rather than a low attribute.
            // We clamp the imputed rating up to 60 in that case.
            static _migratePlayer(p) {
                if (!p) return p;
                if (typeof p.condition !== 'number') p.condition = 100;
                if (typeof p.naturalFitness !== 'number') {
                    const stam = typeof p.stamina === 'number' ? Math.max(60, p.stamina) : 75;
                    const jitter = Math.floor((Math.random() - 0.5) * 16); // ±8
                    p.naturalFitness = Math.max(40, Math.min(95, stam + jitter));
                }
                // If `stamina` looks like a drained value, push it back up to the
                // imputed rating so the attribute panel doesn't show a fatigued
                // player as having a 20 stamina rating forever.
                if (typeof p.stamina === 'number' && p.stamina < 50) {
                    p.stamina = Math.max(p.stamina, p.naturalFitness - 5);
                }
                return p;
            }

            constructor(teamName, excludedColor = null, restored = null, opts = {}) {
                // Restore path — rehydrate from a snapshot produced by serialize().
                // Crest SVG is regenerated from the seed (don't store ~10KB of markup).
                if (restored) {
                    this.teamName    = restored.teamName;
                    this.jerseyColor = restored.jerseyColor;
                    this.homeColor   = restored.homeColor || restored.jerseyColor;
                    this.awayColor   = restored.awayColor || Team.computeAwayColor(restored.jerseyColor);
                    this.clubName    = restored.clubName;
                    this.crestSeed   = restored.crestSeed;
                    this.crestSVG    = CrestGenerator.generateSVG(this.crestSeed, this.jerseyColor, 70);
                    this.crestSVGSm  = CrestGenerator.generateSVG(this.crestSeed, this.jerseyColor, 44);
                    this.players     = (Array.isArray(restored.players) ? restored.players : []).map(Team._migratePlayer);
                    this.homeNation  = restored.homeNation || null;
                    this.budget      = restored.budget != null ? restored.budget : null;
                    this.startingXI  = [];
                    this.bench       = [];
                    this.onField     = [];
                    return;
                }

                // Fresh-generation path
                this.teamName = teamName;
                const jerseyColors = ['#FF0000', '#0000FF', '#FFFF00', '#FF6600', '#FF00FF', '#00FFFF', '#FF4444'];
                const available = excludedColor ? jerseyColors.filter(c => c !== excludedColor) : jerseyColors;
                this.jerseyColor = available[Math.floor(Math.random() * available.length)];
                this.homeColor   = this.jerseyColor;
                this.awayColor   = Team.computeAwayColor(this.jerseyColor);
                this.crestSeed   = Math.floor(Math.random() * 99999);
                this.clubName    = CrestGenerator.generateName(this.crestSeed);
                this.crestSVG    = CrestGenerator.generateSVG(this.crestSeed, this.jerseyColor, 70);
                this.crestSVGSm  = CrestGenerator.generateSVG(this.crestSeed, this.jerseyColor, 44);
                // Home nation drives the dominant nationality in the squad.
                // Budget drives both how many imports the club can afford and the
                // overall quality of the roster (richer clubs sign better players).
                this.homeNation  = opts.homeNation || null;
                this.budget      = opts.budget != null ? opts.budget : 60;  // sensible mid-tier default
                // If a pre-built roster is provided (e.g. the league's persistent
                // CPU club roster), use it as-is so career stats accumulate on
                // the same player objects across matches. Otherwise generate.
                this.players = Array.isArray(opts.players) && opts.players.length
                    ? opts.players
                    : this.generatePlayers();
                this.startingXI = [];
                this.bench = [];
                this.onField = [];
            }

            // JSON-safe snapshot suitable for GameStorage. Saves only the
            // canonical data — crest SVG is regenerated from the seed on load,
            // and startingXI / bench / onField are rebuilt from `players` via
            // setupSquad() so we don't duplicate player references.
            serialize() {
                return {
                    teamName:    this.teamName,
                    jerseyColor: this.jerseyColor,
                    homeColor:   this.homeColor || this.jerseyColor,
                    awayColor:   this.awayColor,
                    clubName:    this.clubName,
                    crestSeed:   this.crestSeed,
                    homeNation:  this.homeNation,   // { code, name, flag, first, last, format }
                    budget:      this.budget,
                    players:     this.players,
                };
            }

            // Rebuild the roster in place using the team's current homeNation /
            // budget / jersey colour. Used after onboarding once we know the
            // user's chosen nation: the initial squad was generated with neutral
            // defaults, and we want to swap to a nation-aware roster.
            regenerateRoster() {
                this.players = this.generatePlayers();
                this.startingXI = [];
                this.bench      = [];
                this.onField    = [];
            }

            // Instance wrapper — the actual roster generation is in the static
            // `Team.createRoster` so callers without a Team instance (e.g. the
            // dramatic-scenes test bench, future replay tools) can produce real
            // game-grade players with one call.
            generatePlayers() {
                return Team.createRoster(this.jerseyColor, {
                    isYouTeam:  this.teamName === 'You',
                    homeNation: this.homeNation,
                    budget:     this.budget,
                });
            }

            // Builds a single player object with name, nationality, position,
            // attributes, avatar, instructions, morale, and per-match stat
            // counters. Pure function — no `this` dependency.
            //
            // opts.position     — defaults to a sensible per-index pick.
            // opts.nation       — force a specific nation entry (overrides the
            //                     weighted global pool). Expected shape:
            //                     { name, flag, first[], last[], format? }.
            // opts.qualityShift — integer applied to every position-attribute
            //                     range (positive = star, negative = lower-tier).
            //                     Drives the wider 50→90 spread per squad.
            static createPlayer(idx, jerseyColor, opts = {}) {
                const outfieldPositions = ['CB', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST', 'CAM', 'CDM', 'LW', 'RW', 'CF', 'LWB', 'RWB'];
                const position = opts.position
                    || (idx < 2 ? 'GK' : outfieldPositions[Math.floor(Math.random() * outfieldPositions.length)]);
                const nation = opts.nation || pickNation();
                const first  = nation.first[Math.floor(Math.random() * nation.first.length)];
                const last   = nation.last [Math.floor(Math.random() * nation.last.length)];
                // Optional middle name (currently used by Vietnam — slots in
                // between last and first per local convention).
                const middle = nation.middle && Math.random() < (nation.middleProb || 0)
                    ? nation.middle[Math.floor(Math.random() * nation.middle.length)]
                    : null;
                const name   = nation.format === 'last_first'
                    ? [last, middle, first].filter(Boolean).join(' ')
                    : [first, middle, last].filter(Boolean).join(' ');
                // Roll height first so generateAttributes can bias `heading` by
                // it (tall players head better — see Team.generateAttributes).
                const height = Team.randomHeight(position);
                const attributes = Team.generateAttributes(position, idx, opts.qualityShift || 0, { height });

                return {
                    id: idx,
                    name,
                    flag: nation.flag,
                    nationality: nation.name,
                    position,                              // current playing position
                    naturalPosition: position,             // what they were trained at (1.0× efficiency here)
                    secondaryPositions: Team.randomSecondaries(position), // 0.88× efficiency
                    number: idx + 1,
                    age:    Team.randomAge(),
                    height,                                 // cm — also influences heading
                    foot:   Team.randomFoot(),              // 'right' | 'left' | 'both'
                    appearances: 0,
                    goals: 0,
                    assists: 0,
                    isOnField: false,
                    avatar: AvatarGenerator.generateAvatar(idx, jerseyColor),
                    instructions: Team.defaultInstructions(position),
                    morale: Team.randomMorale(),
                    // CM 03/04-style match-day Condition (0–100, rolling). Drains
                    // each tick during a match (scaled by `stamina` rating);
                    // recovers each in-game day (scaled by `naturalFitness`).
                    // Fresh players start fully fit.
                    condition: 100,
                    // Per-match performance counters (live with the player; the spread used by
                    // setupSquad / subs keeps the same `stats` reference, so writes from any
                    // reference update the same object).
                    stats: { dribbles: 0, passes: 0, shots: 0, duelsWon: 0, minutesPlayed: 0, subbedOnMinute: null },
                    ...attributes,
                };
            }

            // Budget (in M) → foreign-player ratio. Richer clubs can afford more
            // imports, but it's a soft curve — even at 180M we cap at ~45 %.
            static _foreignRatioFromBudget(budget) {
                const b = (budget != null) ? budget : 60;
                const r = (b - 25) / 280;             // 25M → 0, 130M → 0.375, 180M → ~0.55
                return Math.max(0.02, Math.min(0.45, r));
            }

            // Budget (in M) → per-team quality shift (applied on top of the per-player
            // rank-based shift). Centre at 60M ≈ no shift.
            static _clubQualityFromBudget(budget) {
                const b = (budget != null) ? budget : 60;
                const s = Math.round((b - 60) / 4.5); // 25M → −8, 100M → +9, 150M → +20
                return Math.max(-18, Math.min(25, s));
            }

            // Builds a full 20–25-player roster. First 2 are always GKs (so the
            // squad has a starter + backup); the rest are randomised outfield
            // positions. If `opts.isYouTeam` is true, slot 6 is overwritten with
            // the hand-crafted talisman 'Nguyễn Thế Chí Vỹ' (always overall 93).
            //
            // opts.count       — explicit roster size (default 20–25 random).
            // opts.homeNation  — SEA nation object. Most squad members will be
            //                    drawn from this nation; the rest are foreign.
            // opts.budget      — drives foreign quota + overall club quality.
            // Deterministic position spread so every roster can field every
            // formation (442, 433, 451, 532, 541, 352, 343) without leaning
            // on out-of-position fallbacks. First 20 players follow the
            // blueprint; any extras (depth) are sampled from DEPTH_POOL —
            // weighted toward positions where a backup matters most.
            static POSITION_BLUEPRINT = [
                'GK', 'GK',                              // 2 keepers
                'CB', 'CB', 'CB',                        // 3 centre-backs (covers 3CB + 4CB formations)
                'LB', 'RB',                              // wide back-line
                'LWB', 'RWB',                            // wing-backs for 5-back / 3-5-2 / 3-4-3
                'CDM',                                   // anchor mid
                'CM', 'CM',                              // central mid pair
                'CAM',                                   // attacking mid
                'LM', 'RM',                              // wide midfielders (4-5-1, 4-4-2)
                'LW', 'RW',                              // inverted wingers for 433 / 343
                'ST', 'ST',                              // strike partnership
                'CF',                                    // second-striker / false-9
            ];
            static POSITION_DEPTH = ['CB','CB','CM','CM','ST','LB','RB','CDM','LM','RM','LW','RW'];

            static createRoster(jerseyColor, opts = {}) {
                const count = opts.count != null ? opts.count : (20 + Math.floor(Math.random() * 6));
                const home  = opts.homeNation || null;
                // If the chosen home nation doesn't have name lists yet, fall
                // back to the random global mix so we never produce nameless players.
                const homeUsable = home && Array.isArray(home.first) && Array.isArray(home.last);
                const foreignRatio = Team._foreignRatioFromBudget(opts.budget);
                const clubQuality  = Team._clubQualityFromBudget(opts.budget);

                // Per-player rank-based quality drop: starters (low idx) get the
                // biggest positive shift, reserves at the tail get the largest
                // negative shift. The two ends are roughly [+14 .. −22] before
                // adding the club shift + ±5 jitter.
                const rankShift = (i) => {
                    const t = count <= 1 ? 0 : i / (count - 1);   // 0 → top, 1 → bottom
                    return Math.round(14 - 36 * t);                // 14 → −22
                };

                const players = [];
                const BP = Team.POSITION_BLUEPRINT;
                const DEPTH = Team.POSITION_DEPTH;
                for (let i = 0; i < count; i++) {
                    const useHome = homeUsable && (Math.random() >= foreignRatio);
                    const nation  = useHome ? home : null;         // null → pickNation() globally
                    const jitter  = Random.gaussianInt(0, 5, -8, 8);
                    const shift   = Math.max(-28, Math.min(28, clubQuality + rankShift(i) + jitter));
                    // First 20 slots follow the blueprint so every position
                    // in any supported formation is covered; extras (squad
                    // depth) are sampled from DEPTH_POOL.
                    const position = BP[i] || DEPTH[Math.floor(Math.random() * DEPTH.length)];
                    players.push(Team.createPlayer(i, jerseyColor, { nation, qualityShift: shift, position }));
                }

                // Slot 17 in POSITION_BLUEPRINT is already an ST — overwriting
                // there preserves the rest of the roster's position coverage
                // (the older code clobbered slot 6, which is now RB).
                const vyySlot = 17;
                if (opts.isYouTeam && players[vyySlot]) {
                    players[vyySlot] = {
                        ...players[vyySlot],
                        name: 'Nguyễn Thế Chí Vỹ',
                        flag: '🇻🇳',
                        nationality: 'Vietnamese',
                        position: 'ST',
                        // CM 03/04-style attributes
                        pace: 89, stamina: 88, naturalFitness: 90, condition: 100, strength: 87,
                        finishing: 92, composure: 90, offTheBall: 91,
                        vision: 78, creativity: 75, passing: 85,
                        dribbling: 82, crossing: 60, heading: 87,
                        tackling: 60, marking: 40, positioning: 83,
                        reflexes: 20, handling: 18,
                        determination: 95, anticipation: 88,
                        // Backward-compat aliases
                        shooting: 92, speed: 89, offensive: 91, defensive: 45,
                        influence: 95, luck: 85,
                        overall: 93,
                        morale: 'top',   // talisman is always up for it
                        age: 25, height: 178, foot: 'right',
                        naturalPosition: 'ST',
                        secondaryPositions: ['CF', 'CAM'],   // can drop into the hole
                        stats: { dribbles: 0, passes: 0, shots: 0, duelsWon: 0, minutesPlayed: 0, subbedOnMinute: null },
                    };
                }

                return players;
            }

            // `qualityShift` widens (or narrows) every position-attribute range
            // by the same amount before sampling, then clamps to [1, 99]. A
            // shift of +20 produces a clear top-tier player; a shift of −20
            // produces a journeyman / reserves-grade player. Used by createRoster
            // to spread squads across the CM-style 50→90 spectrum.
            static generateAttributes(position, seed, qualityShift = 0, opts = {}) {
                const rng = AvatarGenerator.seededRandom(seed);
                const r = (lo, hi) => {
                    const lo2 = Math.max(1,  Math.min(99, lo + qualityShift));
                    const hi2 = Math.max(lo2, Math.min(99, hi + qualityShift));
                    return lo2 + Math.floor(rng() * (hi2 - lo2 + 1));
                };

                // CM 03/04-style attribute profiles per position
                const P = {
                    GK:  { pace:[40,58],  stamina:[70,84],  strength:[72,87], finishing:[10,25],  composure:[67,82],  offTheBall:[10,22], vision:[54,70],  creativity:[28,48], passing:[55,72],  dribbling:[18,34], crossing:[18,34],  heading:[72,87],  tackling:[24,40],  marking:[34,52],  positioning:[77,92], reflexes:[78,93],  handling:[78,93],  determination:[67,83], anticipation:[72,88] },
                    CB:  { pace:[53,70],  stamina:[72,87],  strength:[80,95], finishing:[20,38],  composure:[63,79],  offTheBall:[22,40], vision:[40,58],  creativity:[26,44], passing:[57,74],  dribbling:[30,48], crossing:[28,46],  heading:[80,95],  tackling:[78,93],  marking:[82,97],  positioning:[76,92], reflexes:[22,38],  handling:[18,33],  determination:[72,88], anticipation:[74,90] },
                    LB:  { pace:[77,92],  stamina:[82,96],  strength:[64,80], finishing:[33,54],  composure:[59,76],  offTheBall:[50,67], vision:[52,69],  creativity:[46,63], passing:[66,83],  dribbling:[57,74], crossing:[70,86],  heading:[51,68],  tackling:[70,86],  marking:[71,87],  positioning:[66,83], reflexes:[18,33],  handling:[14,28],  determination:[73,89], anticipation:[64,81] },
                    RB:  { pace:[77,92],  stamina:[82,96],  strength:[64,80], finishing:[33,54],  composure:[59,76],  offTheBall:[50,67], vision:[52,69],  creativity:[46,63], passing:[66,83],  dribbling:[57,74], crossing:[70,86],  heading:[51,68],  tackling:[70,86],  marking:[71,87],  positioning:[66,83], reflexes:[18,33],  handling:[14,28],  determination:[73,89], anticipation:[64,81] },
                    LWB: { pace:[81,96],  stamina:[84,97],  strength:[62,78], finishing:[40,60],  composure:[57,74],  offTheBall:[60,76], vision:[53,70],  creativity:[50,67], passing:[66,83],  dribbling:[66,83], crossing:[75,91],  heading:[43,62],  tackling:[66,82],  marking:[63,80],  positioning:[61,78], reflexes:[14,28],  handling:[10,24],  determination:[77,93], anticipation:[63,80] },
                    RWB: { pace:[81,96],  stamina:[84,97],  strength:[62,78], finishing:[40,60],  composure:[57,74],  offTheBall:[60,76], vision:[53,70],  creativity:[50,67], passing:[66,83],  dribbling:[66,83], crossing:[75,91],  heading:[43,62],  tackling:[66,82],  marking:[63,80],  positioning:[61,78], reflexes:[14,28],  handling:[10,24],  determination:[77,93], anticipation:[63,80] },
                    CDM: { pace:[59,76],  stamina:[85,97],  strength:[74,89], finishing:[40,58],  composure:[65,82],  offTheBall:[46,63], vision:[62,79],  creativity:[52,70], passing:[72,88],  dribbling:[47,65], crossing:[42,60],  heading:[67,83],  tackling:[82,97],  marking:[75,91],  positioning:[71,88], reflexes:[18,33],  handling:[14,28],  determination:[79,94], anticipation:[74,90] },
                    CM:  { pace:[63,80],  stamina:[82,95],  strength:[63,80], finishing:[50,68],  composure:[67,84],  offTheBall:[57,75], vision:[67,84],  creativity:[63,80], passing:[75,91],  dribbling:[55,73], crossing:[49,67],  heading:[54,71],  tackling:[64,82],  marking:[53,72],  positioning:[60,78], reflexes:[14,28],  handling:[10,24],  determination:[70,87], anticipation:[64,82] },
                    CAM: { pace:[69,86],  stamina:[70,86],  strength:[52,70], finishing:[71,88],  composure:[73,90],  offTheBall:[74,90], vision:[77,93],  creativity:[79,95], passing:[72,89],  dribbling:[72,89], crossing:[53,72],  heading:[44,63],  tackling:[33,52],  marking:[26,46],  positioning:[52,71], reflexes:[10,24],  handling:[8,22],   determination:[69,86], anticipation:[69,86] },
                    LM:  { pace:[76,92],  stamina:[75,90],  strength:[56,73], finishing:[56,73],  composure:[61,78],  offTheBall:[66,83], vision:[62,79],  creativity:[64,81], passing:[69,86],  dribbling:[69,86], crossing:[69,86],  heading:[48,66],  tackling:[54,72],  marking:[43,61],  positioning:[54,72], reflexes:[12,26],  handling:[8,22],   determination:[66,83], anticipation:[60,77] },
                    RM:  { pace:[76,92],  stamina:[75,90],  strength:[56,73], finishing:[56,73],  composure:[61,78],  offTheBall:[66,83], vision:[62,79],  creativity:[64,81], passing:[69,86],  dribbling:[69,86], crossing:[69,86],  heading:[48,66],  tackling:[54,72],  marking:[43,61],  positioning:[54,72], reflexes:[12,26],  handling:[8,22],   determination:[66,83], anticipation:[60,77] },
                    LW:  { pace:[82,97],  stamina:[68,84],  strength:[51,68], finishing:[63,81],  composure:[60,77],  offTheBall:[74,91], vision:[58,76],  creativity:[70,87], passing:[60,78],  dribbling:[80,97], crossing:[74,91],  heading:[38,57],  tackling:[29,50],  marking:[26,47],  positioning:[46,65], reflexes:[8,22],   handling:[5,19],   determination:[64,81], anticipation:[56,74] },
                    RW:  { pace:[82,97],  stamina:[68,84],  strength:[51,68], finishing:[63,81],  composure:[60,77],  offTheBall:[74,91], vision:[58,76],  creativity:[70,87], passing:[60,78],  dribbling:[80,97], crossing:[74,91],  heading:[38,57],  tackling:[29,50],  marking:[26,47],  positioning:[46,65], reflexes:[8,22],   handling:[5,19],   determination:[64,81], anticipation:[56,74] },
                    ST:  { pace:[76,92],  stamina:[68,84],  strength:[74,90], finishing:[81,97],  composure:[75,92],  offTheBall:[76,92], vision:[49,68],  creativity:[51,70], passing:[51,70],  dribbling:[60,77], crossing:[35,54],  heading:[73,90],  tackling:[19,40],  marking:[16,37],  positioning:[66,83], reflexes:[8,22],   handling:[5,19],   determination:[73,90], anticipation:[68,85] },
                    CF:  { pace:[74,91],  stamina:[68,84],  strength:[68,85], finishing:[77,94],  composure:[75,92],  offTheBall:[73,90], vision:[60,79],  creativity:[64,82], passing:[60,79],  dribbling:[66,84], crossing:[39,58],  heading:[64,81],  tackling:[21,42],  marking:[18,39],  positioning:[64,82], reflexes:[8,22],   handling:[5,19],   determination:[70,87], anticipation:[66,84] },
                };

                // CM 03/04 "Natural Fitness" — drives between-match condition
                // recovery (and lowers injury risk). Mild positional variation:
                // wing-backs / box-to-box mids highest; GKs and pure forwards
                // a tier lower. The static rating is independent of stamina —
                // a player can have high in-match stamina but slow recovery.
                const NF_RANGES = {
                    GK:  [60, 78], CB:  [65, 82], LB:  [78, 92], RB:  [78, 92],
                    LWB: [80, 94], RWB: [80, 94], CDM: [72, 88], CM:  [75, 90],
                    CAM: [70, 86], LM:  [76, 90], RM:  [76, 90],
                    LW:  [72, 88], RW:  [72, 88], ST:  [68, 84], CF:  [70, 85],
                };

                const profile = P[position] || P.CM;
                const attrs = { naturalFitness: r(...(NF_RANGES[position] || [70, 86])) };
                for (const [key, [lo, hi]] of Object.entries(profile)) {
                    attrs[key] = r(lo, hi);
                }

                // Height contributes to heading. Reference is a universal 180 cm
                // (~global outfield average), 0.6 points per cm of deviation.
                //   195 cm → +9 heading · 175 cm → −3 · 165 cm → −9
                // A tall winger heads better than a short winger even though both
                // play in a low-heading role; a tall ST is a real aerial threat.
                if (opts.height != null) {
                    const bias = Math.round((opts.height - 180) * 0.6);
                    attrs.heading = Math.max(1, Math.min(99, (attrs.heading || 0) + bias));
                }

                // Position-weighted overall rating for squad selection sorting.
                // Run AFTER the height adjustment so the adjusted heading flows
                // into the overall (CB / ST weight heading heavily).
                attrs.overall = Math.round(Team.computeOverall(position, attrs));

                // Backward-compatible aliases used by display and legacy logic
                attrs.shooting  = attrs.finishing;
                attrs.speed     = attrs.pace;
                attrs.offensive = attrs.offTheBall;
                attrs.defensive = attrs.positioning;

                attrs.influence = r(55, 99);
                attrs.luck      = r(0, 99);

                return attrs;
            }

            static computeOverall(position, attrs) {
                const W = {
                    GK:  { reflexes:3,    handling:3,    positioning:2.5, composure:1,    stamina:0.5,  determination:0.5 },
                    CB:  { marking:3,     tackling:3,    heading:2.5,     positioning:2,  anticipation:1.5, strength:1, stamina:0.5 },
                    LB:  { tackling:2,    marking:2,     crossing:2,      pace:1.5,       stamina:1.5,  determination:1 },
                    RB:  { tackling:2,    marking:2,     crossing:2,      pace:1.5,       stamina:1.5,  determination:1 },
                    LWB: { pace:2.5,      crossing:2.5,  stamina:2,       tackling:1.5,   dribbling:1.5, determination:1 },
                    RWB: { pace:2.5,      crossing:2.5,  stamina:2,       tackling:1.5,   dribbling:1.5, determination:1 },
                    CDM: { tackling:3,    stamina:2.5,   marking:2,       determination:2, passing:1.5,  anticipation:1.5 },
                    CM:  { passing:2.5,   stamina:2,     vision:2,        tackling:1.5,   creativity:1.5, determination:1.5 },
                    CAM: { creativity:3,  vision:3,      finishing:2,     composure:2,    offTheBall:2 },
                    LM:  { pace:2,        passing:2,     crossing:2,      dribbling:2,    stamina:1.5,  creativity:1.5 },
                    RM:  { pace:2,        passing:2,     crossing:2,      dribbling:2,    stamina:1.5,  creativity:1.5 },
                    LW:  { dribbling:3,   pace:2.5,      finishing:2,     offTheBall:2,   creativity:1.5, crossing:1.5 },
                    RW:  { dribbling:3,   pace:2.5,      finishing:2,     offTheBall:2,   creativity:1.5, crossing:1.5 },
                    ST:  { finishing:3,   composure:2.5, offTheBall:2,    heading:2,      pace:1.5,     strength:1.5, anticipation:1 },
                    CF:  { finishing:3,   composure:2.5, offTheBall:2,    creativity:1.5, pace:1.5,     dribbling:1.5 },
                };
                const w = W[position] || W.CM;
                let total = 0, wSum = 0;
                for (const [attr, weight] of Object.entries(w)) {
                    total += (attrs[attr] || 50) * weight;
                    wSum  += weight;
                }
                return total / wSum;
            }

            // ─── Squad-level strength (CM 03/04-style aggregate) ─────────────
            // CM 03/04 has no published "team strength" number, but every club is
            // implicitly evaluated by summing the squad's Current Abilities, with
            // the starting XI dominating and the bench / reserves discounted.
            // This mirrors that idea — see README §3 (per-zone ratings already
            // exist for the live XI; this is the *squad-wide* analogue).
            //
            // Returns:
            //   { overall, attack, midfield, defense, breakdown, bestXI, bench }
            //   — every number on a 0–100 scale.

            // Position penalty for playing a player out of role:
            //   1.00 natural · 0.88 secondary · 0.72 same family · 0.50 cross-family.
            // Standalone helper (ZoneStrength.positionMult reads player.position;
            // here we need to score arbitrary candidate roles without mutating).
            static _rolePenalty(player, role) {
                if (!player || !role) return 1.00;
                if (player.naturalPosition === role) return 1.00;
                if ((player.secondaryPositions || []).includes(role)) return 0.88;
                const fam = (typeof ZoneStrength !== 'undefined') ? ZoneStrength.POSITION_FAMILY : null;
                if (fam && fam[player.naturalPosition] && fam[player.naturalPosition] === fam[role]) return 0.72;
                return 0.50;
            }

            // Greedy best-XI selection. Walks the formation's SLOT_POSITIONS in
            // order; for each slot, picks the highest-rated unused player at that
            // role. Returns an array of 11 picks (or fewer if the squad is short).
            static _pickBestXI(squad, formation) {
                const slots = Team.SLOT_POSITIONS[formation] || Team.SLOT_POSITIONS['442'];
                const pool  = (squad || []).slice();
                const picks = [];
                for (const role of slots) {
                    let best = null, bestIdx = -1, bestRating = -Infinity;
                    for (let i = 0; i < pool.length; i++) {
                        const p = pool[i];
                        const r = Team.computeOverall(role, p) * Team._rolePenalty(p, role);
                        if (r > bestRating) { bestRating = r; best = p; bestIdx = i; }
                    }
                    if (best) {
                        picks.push({ player: best, role, rating: bestRating });
                        pool.splice(bestIdx, 1);
                    }
                }
                return { picks, remaining: pool };
            }

            // Squad strength. Computes:
            //   1. Best XI for the formation + their per-zone (attack/mid/defense) avg
            //   2. Bench-depth from the next 7 best
            //   3. Position-coverage check (need ≥ 2 of GK / CB / CM / ST)
            //   4. Formation bonus
            //   5. Weighted aggregate → overall
            static computeSquadStrength(squad, formation = '442') {
                const safe = Array.isArray(squad) ? squad : [];
                if (safe.length === 0) {
                    return { overall: 50, attack: 50, midfield: 50, defense: 50,
                             breakdown: { bestXI: 50, benchDepth: 50, coverage: 0, formation: 1 },
                             bestXI: [], bench: [] };
                }

                // 1) Best XI for the requested formation
                const { picks, remaining } = Team._pickBestXI(safe, formation);
                const bestXIAvg = picks.length
                    ? picks.reduce((s, x) => s + x.rating, 0) / picks.length
                    : 50;

                // 2) Per-zone averages bucketed by the slot's role (not natural position)
                const ATTACK_POS  = (typeof ZoneStrength !== 'undefined') ? ZoneStrength.ATTACK_POS  : ['ST','CF','LW','RW','CAM'];
                const MID_POS     = (typeof ZoneStrength !== 'undefined') ? ZoneStrength.MID_POS     : ['CM','CDM','LM','RM'];
                const DEFENSE_POS = (typeof ZoneStrength !== 'undefined') ? ZoneStrength.DEFENSE_POS : ['CB','LB','RB','LWB','RWB'];
                const fbonus = (typeof ZoneStrength !== 'undefined') ? ZoneStrength.formationBonus(formation)
                                                                    : { attack: 1, midfield: 1, defense: 1 };

                let atkSum = 0, atkN = 0, midSum = 0, midN = 0, defSum = 0, defN = 0;
                picks.forEach(x => {
                    if (ATTACK_POS.includes(x.role))       { atkSum += x.rating; atkN++; }
                    else if (MID_POS.includes(x.role))     { midSum += x.rating; midN++; }
                    else if (DEFENSE_POS.includes(x.role)) { defSum += x.rating; defN++; }
                    // GK contributes to defense too (covers the formation's last line)
                    if (x.role === 'GK') { defSum += x.rating; defN++; }
                });
                const attack   = (atkN ? atkSum / atkN : bestXIAvg) * fbonus.attack;
                const midfield = (midN ? midSum / midN : bestXIAvg) * fbonus.midfield;
                const defense  = (defN ? defSum / defN : bestXIAvg) * fbonus.defense;

                // 3) Bench depth — next 7 best players by their best-role rating
                const rankedRest = remaining
                    .map(p => {
                        let best = 0;
                        const allRoles = ['GK','CB','CDM','LB','RB','LWB','RWB','CM','CAM','LM','RM','LW','RW','ST','CF'];
                        for (const r of allRoles) {
                            const v = Team.computeOverall(r, p) * Team._rolePenalty(p, r);
                            if (v > best) best = v;
                        }
                        return { player: p, rating: best };
                    })
                    .sort((a, b) => b.rating - a.rating);
                const bench = rankedRest.slice(0, 7);
                const benchDepth = bench.length
                    ? bench.reduce((s, x) => s + x.rating, 0) / bench.length
                    : Math.max(40, bestXIAvg - 20);   // shallow squads still get *something*

                // 4) Position coverage — need ≥ 2 players who can play each critical role
                const criticalRoles = ['GK', 'CB', 'CM', 'ST'];
                let coverageScore = 0;
                criticalRoles.forEach(role => {
                    const n = safe.filter(p =>
                        p.naturalPosition === role || (p.secondaryPositions || []).includes(role)
                    ).length;
                    coverageScore += Math.min(1, n / 2);
                });
                const coverage = coverageScore / criticalRoles.length;   // 0..1

                // 5) Formation bonus (averaged across the three zones)
                const formationFactor = (fbonus.attack + fbonus.midfield + fbonus.defense) / 3;

                // 6) Aggregate — weighted blend, then apply coverage as a 0.85–1.00 multiplier
                let overall = (
                    0.60 * bestXIAvg
                  + 0.20 * benchDepth
                  + 0.10 * ((attack + midfield + defense) / 3)
                  + 0.10 * formationFactor * 100        // bonus scaled into 0–100 range
                );
                overall *= (0.85 + 0.15 * coverage);
                overall = Math.max(0, Math.min(100, overall));

                return {
                    overall:  Math.round(overall),
                    attack:   Math.round(Math.max(0, Math.min(100, attack))),
                    midfield: Math.round(Math.max(0, Math.min(100, midfield))),
                    defense:  Math.round(Math.max(0, Math.min(100, defense))),
                    breakdown: {
                        bestXI:     Math.round(bestXIAvg),
                        benchDepth: Math.round(benchDepth),
                        coverage:   Math.round(coverage * 100) / 100,
                        formation:  Math.round(formationFactor * 100) / 100,
                    },
                    bestXI: picks,
                    bench,
                };
            }

            setupSquad(formation) {
                const formationNums = {
                    '442': [1, 4, 4, 2],
                    '433': [1, 4, 3, 3],
                    '451': [1, 4, 5, 1],
                    '532': [1, 5, 3, 2],
                    '541': [1, 5, 4, 1],
                    '352': [1, 3, 5, 2],
                    '343': [1, 3, 4, 3]
                };

                const nums = formationNums[formation] || formationNums['442'];
                const needed = nums.reduce((a, b) => a + b, 0); // always 11

                const byOverall = arr => [...arr].sort((a, b) => (b.overall || 0) - (a.overall || 0));
                const gks  = byOverall(this.players.filter(p => p.position === 'GK'));
                const defs = byOverall(this.players.filter(p => ['CB','LB','RB','RWB','LWB'].includes(p.position)));
                const mids = byOverall(this.players.filter(p => ['CM','CDM','CAM','LM','RM','LW','RW'].includes(p.position)));
                const fwds = byOverall(this.players.filter(p => ['ST','CF'].includes(p.position)));

                const used = new Set();
                const pick = (pool, n) => {
                    const out = [];
                    for (const p of pool) {
                        if (out.length >= n) break;
                        if (!used.has(p.id)) { out.push(p); used.add(p.id); }
                    }
                    return out;
                };

                const lineup = [];

                // GK — always first (pitch renderer maps index 0 → GK position)
                const gkPick = pick(gks, 1);
                if (gkPick.length === 0) {
                    const fallback = this.players.find(p => !used.has(p.id));
                    if (fallback) { fallback.position = 'GK'; gkPick.push(fallback); used.add(fallback.id); }
                }
                lineup.push(...gkPick);

                lineup.push(...pick(defs, nums[1]));
                lineup.push(...pick(mids, nums[2]));

                // Special player — guaranteed in forward section for player team
                if (this.teamName === 'You') {
                    const special = this.players.find(p => p.name === 'Nguyễn Thế Chí Vỹ');
                    if (special && !used.has(special.id)) {
                        lineup.push(special);
                        used.add(special.id);
                    }
                }

                lineup.push(...pick(fwds, nums[3]));

                // Fill any shortfall with the best remaining non-GK players
                if (lineup.length < needed) {
                    const rest = byOverall(this.players.filter(p => !used.has(p.id) && p.position !== 'GK'));
                    lineup.push(...pick(rest, needed - lineup.length));
                }

                this.startingXI = lineup.slice(0, needed);
                this.bench = this.players.filter(p => !this.startingXI.find(s => s.id === p.id));
                this.onField = this.startingXI.map(p => ({...p, isOnField: true}));

                // Force each onField slot to play its formation-expected role. Natural positions
                // are preserved so the efficiency penalty kicks in for mismatches.
                this.assignSlotPositions(formation);
                // Bench players go back to their natural position label.
                this.bench.forEach(p => { p.position = p.naturalPosition || p.position; });
            }

            // Set each onField player's `position` to match the formation slot they occupy.
            // No-op if the squad doesn't have exactly 11 players (e.g. after a red card).
            assignSlotPositions(formation) {
                const slots = Team.SLOT_POSITIONS[formation];
                if (!slots || this.onField.length !== slots.length) return;
                this.onField.forEach((p, idx) => {
                    p.position = slots[idx];
                });
            }

            getRandomPlayer(onFieldOnly = false) {
                const pool = onFieldOnly ? this.onField : this.players;
                return pool[Math.floor(Math.random() * pool.length)];
            }

            makeSubstitution() {
                if (this.bench.length === 0) return null;

                const playerOut = this.onField[Math.floor(Math.random() * this.onField.length)];
                const playerIn = this.bench[0];

                const outIndex = this.onField.indexOf(playerOut);
                this.onField[outIndex] = playerIn;
                this.bench = this.bench.filter(p => p.id !== playerIn.id);
                this.bench.push(playerOut);

                return { playerOut, playerIn };
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // FootballRules — single source of truth for all in-match rule logic.
        // Stateful per match: tracks yellow cards, send-offs and sub quotas.
        // ─────────────────────────────────────────────────────────────────────
        class FootballRules {
            constructor() {
                this.yellowCards = new Map(); // player.id → yellow count
                this.sentOff     = new Set(); // player.id
                this.subCount    = { player: 0, cpu: 0 };
                this.MAX_SUBS    = 5;
            }

            reset() {
                this.yellowCards.clear();
                this.sentOff.clear();
                this.subCount = { player: 0, cpu: 0 };
            }

            isSentOff(player)      { return this.sentOff.has(player.id); }
            yellowCount(player)    { return this.yellowCards.get(player.id) || 0; }
            canSubstitute(teamKey) { return this.subCount[teamKey] < this.MAX_SUBS; }
            subsRemaining(teamKey) { return this.MAX_SUBS - this.subCount[teamKey]; }
            recordSub(teamKey)     { this.subCount[teamKey]++; }

            // Convert real elapsed seconds (60-second match) to a display match-minute (1–90).
            getMatchMinute(timeRemaining) {
                const elapsed = Math.max(0, 60 - timeRemaining);
                return Math.max(1, Math.min(90, Math.round(elapsed / 60 * 90)));
            }

            // Issue a card to a player.
            // Returns null if the player is already sent off.
            // Returns { cardType: 'yellow' | 'second_yellow' | 'red', sendOff: boolean }
            issueCard(player, requestedType) {
                if (this.isSentOff(player)) return null;

                let cardType = requestedType;
                let sendOff  = false;

                if (requestedType === 'yellow') {
                    const newCount = (this.yellowCards.get(player.id) || 0) + 1;
                    this.yellowCards.set(player.id, newCount);
                    if (newCount >= 2) {
                        cardType = 'second_yellow';
                        sendOff  = true;
                    }
                } else {
                    sendOff = true; // direct red
                }

                if (sendOff) this.sentOff.add(player.id);
                return { cardType, sendOff };
            }

            // Remove a sent-off player from the team's onField array.
            removeFromField(teamObj, player) {
                const idx = teamObj.onField.findIndex(p => p.id === player.id);
                if (idx !== -1) teamObj.onField.splice(idx, 1);
            }

            // Handle GK being sent off.
            // Brings backup GK from bench (uses a sub slot) if available,
            // otherwise converts the best outfield defender to emergency GK.
            handleGKSendOff(teamObj, teamKey, addEvent) {
                const benchGK = teamObj.bench.find(p => p.position === 'GK' && !this.isSentOff(p));

                if (benchGK && this.canSubstitute(teamKey)) {
                    teamObj.onField.push({ ...benchGK, isOnField: true });
                    teamObj.bench = teamObj.bench.filter(p => p.id !== benchGK.id);
                    this.recordSub(teamKey);
                    addEvent(
                        `🧤 Emergency GK sub — <b class="ev-name">${benchGK.name}</b> comes on in goal!`,
                        'save', teamKey
                    );
                } else {
                    // No GK on bench or no sub slots left — outfield player takes the gloves
                    const priority = ['CB', 'CDM', 'LB', 'RB', 'CM', 'LWB', 'RWB'];
                    let emergency = null;
                    for (const pos of priority) {
                        emergency = teamObj.onField.find(p => p.position === pos);
                        if (emergency) break;
                    }
                    if (!emergency) emergency = teamObj.onField[0];
                    if (emergency) {
                        const oldPos = emergency.position;
                        emergency.position = 'GK';
                        addEvent(
                            `🧤 <b class="ev-name">${emergency.name}</b> (${oldPos}) takes the gloves — emergency goalkeeper!`,
                            'save', teamKey
                        );
                    }
                }
            }
        }

        class FootballSimulator {
            constructor() {
                console.log('FootballSimulator constructor starting...');

                // Verify that all required classes exist
                if (typeof PitchRenderer === 'undefined') {
                    throw new Error('PitchRenderer class not found');
                }
                if (typeof AnimationEngine === 'undefined') {
                    throw new Error('AnimationEngine class not found');
                }
                if (typeof MatchFlow === 'undefined') {
                    throw new Error('MatchFlow class not found — ensure game-flow.js is loaded before football-sim.js');
                }

                this.isPreMatch = true;
                this.playerFormation = '442';
                this.cpuFormation = null;
                this.playerTeam = null;
                this.cpuTeam = null;
                this.playerScore = 0;
                this.cpuScore = 0;
                this.timeRemaining = 60;
                this.isRunning = false;
                this.isPaused = false;
                this.stats = {
                    playerShots: 0, cpuShots: 0,
                    playerShotsOnTarget: 0, cpuShotsOnTarget: 0,
                    playerTackles: 0, cpuTackles: 0,
                    playerPasses: 0, cpuPasses: 0,
                    playerPassesCompleted: 0, cpuPassesCompleted: 0,
                    playerCorners: 0, cpuCorners: 0,
                    playerFouls: 0, cpuFouls: 0,
                    playerOffsides: 0, cpuOffsides: 0,
                    playerFreeKicks: 0, cpuFreeKicks: 0,
                    playerPossession: 50, cpuPossession: 50,
                };
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                this.goals = [];
                this.substitutions = [];
                this.cardData = { player: [], cpu: [] };
                this.teamInstruction = 'neutral'; // kept for legacy compat
                this.tactics = { mentality: 'normal', closingDown: 'standard', tackling: 'normal', passing: 'mixed', marking: 'zonal', timeWasting: 'mixed', counterAttack: 'no', autoSubs: { onInjury: 'on', onStamina: 'off', onPerformance: 'off' } };
                // Restore previously-saved tactics + formation if a career is in progress
                const savedTactics = (typeof GameStorage !== 'undefined') ? GameStorage.loadTactics() : null;
                if (savedTactics) {
                    if (savedTactics.tactics) this.tactics = { ...this.tactics, ...savedTactics.tactics };
                    if (savedTactics.formation) this.playerFormation = savedTactics.formation;
                }
                this.momentum = 50; // 0=CPU dominates, 100=player dominates
                this._attackPhase = null; // null | 'buildup' | 'progression' | 'danger'
                this._attackTeam  = null; // 'player' | 'cpu'
                this._phaseTicks  = 0;
                // Where on the pitch the current ball action is — 5 bands × 3 lanes (matches debug grid).
                // Updated by every phase tick and every event so the visual layer can place the ball.
                this._attackBand  = 2;    // 0…4 (left-to-right on screen, 0 = player goal end, 4 = CPU goal end)
                this._attackLane  = 1;    // 0…2 (top to bottom)
                this.matchSpeed   = 'fast';   // 'slow' | 'normal' | 'fast' — 'fast' preserves legacy 500ms/1000ms pace
                this._cpuLastFormationChangeMinute = 0;  // CPU AI cooldown tracker
                this.audio        = (typeof AudioFx !== 'undefined') ? new AudioFx() : null;
                this.dramatic     = (typeof DramaticOverlay !== 'undefined') ? new DramaticOverlay(this) : null;
                // Apply saved settings (mute / volume / match speed) before any audio plays
                if (typeof GameStorage !== 'undefined') {
                    const s = GameStorage.loadSettings();
                    if (this.audio) {
                        this.audio.setMuted(!!s.muted);
                        if (typeof s.volume === 'number') this.audio.setVolume(s.volume);
                    }
                    if (s.speed) this.matchSpeed = s.speed;
                }
                this.debugMode    = false;   // toggled by triple-clicking the match clock
                this._timerClickCount = 0;
                this._timerClickTimer = null;
                this.rules = new FootballRules();
                console.log('Creating PitchRenderer...');
                this.pitchRenderer = new PitchRenderer();
                console.log('Creating AnimationEngine...');
                this.animationEngine = new AnimationEngine(this.pitchRenderer);
                this.matchFlow = null;
                console.log('Initializing pre-match team...');
                // Restore the player team from storage if a career snapshot exists;
                // otherwise generate a fresh "You" squad as before.
                const savedTeam = (typeof GameStorage !== 'undefined') ? GameStorage.loadPlayerTeam() : null;
                if (savedTeam && Array.isArray(savedTeam.players) && savedTeam.players.length) {
                    console.log('Restoring saved player team:', savedTeam.clubName);
                    this.playerTeam = new Team('You', null, savedTeam);
                } else {
                    this.playerTeam = new Team('You');
                }
                this.playerTeam.setupSquad(this.playerFormation);
                console.log('Setting up event listeners...');
                this.setupEventListeners();
                console.log('FootballSimulator constructor complete');
            }

            setupEventListeners() {
                try {
                    console.log('setupEventListeners: Starting');
                    // Formation buttons inside .mgmt-panel are wired via the
                    // delegated handler in _wireMgmtPanelHandlers(). Only the
                    // legacy formationScreen still needs direct listeners.
                    document.querySelectorAll('#formationScreen .formation-btn').forEach(btn => {
                        btn.addEventListener('click', () => this.selectFormation(btn));
                    });

                    const startBtn = document.getElementById('startBtn');
                    if (startBtn) {
                        console.log('setupEventListeners: Setting up Start button');
                        startBtn.addEventListener('click', () => {
                            console.log('Start button clicked');
                            this.startMatch();
                        });
                    } else {
                        console.warn('setupEventListeners: Start button not found');
                    }

                    const pauseBtn = document.getElementById('pauseBtn');
                    if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());

                    // Mute toggle for synthetic match sounds. Also serves as the first-gesture
                    // trigger for AudioContext init on some browsers.
                    const muteBtn = document.getElementById('muteBtn');
                    if (muteBtn) {
                        // Settings (incl. muted) were already applied in the constructor —
                        // here we just reflect that state in the button + wire the click.
                        const startMuted = !!this.audio?.muted;
                        muteBtn.textContent = startMuted ? '🔇' : '🔊';
                        muteBtn.classList.toggle('muted', startMuted);
                        muteBtn.addEventListener('click', () => {
                            if (!this.audio) return;
                            this.audio.setMuted(!this.audio.muted);
                            muteBtn.textContent = this.audio.muted ? '🔇' : '🔊';
                            muteBtn.classList.toggle('muted', this.audio.muted);
                            if (typeof GameStorage !== 'undefined') {
                                GameStorage.saveSettings({ muted: this.audio.muted });
                            }
                            if (!this.audio.muted) this.audio.click();
                        });
                    }

                    // Triple-click on the match clock toggles debug mode (zone-rating overlay).
                    const timerEl = document.getElementById('timer');
                    if (timerEl) timerEl.addEventListener('click', () => this._registerTimerClick());

                    const manageBtn = document.getElementById('manageBtn');
                    if (manageBtn) manageBtn.addEventListener('click', () => this.openManagement());

                    // Resume Match button inside .mgmt-panel is wired via
                    // MgmtComponents.setPrimaryAction() in renderManagementPanel.

                    const backToClubhouseBtn = document.getElementById('backToClubhouseBtn');
                    if (backToClubhouseBtn) backToClubhouseBtn.addEventListener('click', () => {
                        this._finalizeMatchDay();
                    });

                    // Tactic buttons inside .mgmt-panel are wired via the
                    // delegated handler in _wireMgmtPanelHandlers().
                    document.querySelectorAll('.speed-btn').forEach(btn => {
                        btn.addEventListener('click', () => this.setMatchSpeed(btn.dataset.speed));
                    });

                    // Top floating menu bar + hamburger dropdown
                    this.setupTopMenu();
                    // Floating bottom nav (back / forward) + nav stack init
                    this._initNavStack();
                    // Mount the two mgmt-components variants:
                    //   .match-mgmt-host → Match Management layout (in-game)
                    //   .tactic-host     → Tactic layout (clubhouse planning)
                    // Each host owns its own .mgmt-panel scope so per-screen
                    // state (open overlays, pending subs) stays isolated.
                    if (typeof MgmtComponents !== 'undefined') {
                        document.querySelectorAll('.match-mgmt-host, .tactic-host').forEach(host => {
                            MgmtComponents.mount(host);
                        });
                        this._wireMgmtPanelHandlers();
                    }

                    // First-run onboarding: prompt for a manager name if none saved.
                    // If a manager + league already exist, skip onboarding and land
                    // directly on the Clubhouse.
                    this.setupOnboarding();
                    if (typeof GameStorage !== 'undefined') {
                        const mgr = GameStorage.loadManager();
                        if (!mgr || !mgr.name) {
                            this._showOnboarding();
                        } else {
                            this._refreshManagerLabel();
                            this._refreshDateLabel();
                            if (mgr.clubName) {
                                // Defer until the management panel render is finished so
                                // switchScreen finds the clubhouse partial in the DOM.
                                setTimeout(() => this._enterClubhouse(), 0);
                            }
                        }
                    }

                    // Render management panel now that team is initialized
                    this.renderManagementPanel();
                } catch (error) {
                    console.error('Error setting up event listeners:', error);
                }
            }

            // ─── Top floating menu bar (hamburger dropdown) ──────────────────
            setupTopMenu() {
                const hamb = document.getElementById('hamburgerBtn');
                const drop = document.getElementById('topMenuDropdown');
                if (!hamb || !drop) return;

                const setOpen = (open) => {
                    drop.style.display = open ? 'block' : 'none';
                    hamb.setAttribute('aria-expanded', String(open));
                    if (open) this._refreshTopMenuState();
                };
                const isOpen = () => drop.style.display !== 'none';

                hamb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setOpen(!isOpen());
                });

                // Click outside → close. Use capture so it runs before item clicks
                // close the menu prematurely.
                document.addEventListener('click', (e) => {
                    if (!isOpen()) return;
                    if (drop.contains(e.target) || e.target === hamb) return;
                    setOpen(false);
                });

                // Esc → close
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && isOpen()) setOpen(false);
                });

                // Menu item actions
                drop.querySelectorAll('[data-menu-action]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.menuAction;
                        const oneShot = action === 'show-history' || action === 'reset-career';
                        this._handleMenuAction(action);
                        this._refreshTopMenuState();
                        if (oneShot) setOpen(false);
                    });
                });

                // Initial labels (mute / speed / debug)
                this._refreshTopMenuState();
            }

            // Refreshes the right-aligned "On / Fast / Off" labels in the dropdown
            _refreshTopMenuState() {
                const sound = document.getElementById('tmSoundState');
                if (sound) sound.textContent = (this.audio?.muted) ? 'Off' : 'On';
                const speed = document.getElementById('tmSpeedState');
                if (speed && this.matchSpeed) {
                    speed.textContent = this.matchSpeed.charAt(0).toUpperCase() + this.matchSpeed.slice(1);
                }
                const dbg = document.getElementById('tmDebugState');
                if (dbg) dbg.textContent = this.debugMode ? 'On' : 'Off';

                // Pause — only meaningful while a match is running. Disable
                // (and dim the label) otherwise so it's obvious it's a no-op.
                const pauseBtn   = document.getElementById('tmPauseBtn');
                const pauseState = document.getElementById('tmPauseState');
                const inMatch    = !!this.isRunning;
                if (pauseBtn)   pauseBtn.disabled = !inMatch;
                if (pauseState) pauseState.textContent = !inMatch ? '—' : (this.isPaused ? 'Paused' : 'Running');
            }

            _handleMenuAction(action) {
                switch (action) {
                    case 'toggle-sound': {
                        if (!this.audio) return;
                        this.audio.setMuted(!this.audio.muted);
                        if (typeof GameStorage !== 'undefined') {
                            GameStorage.saveSettings({ muted: this.audio.muted });
                        }
                        // Keep the existing in-match mute button in sync if it's mounted
                        const btn = document.getElementById('muteBtn');
                        if (btn) {
                            btn.textContent = this.audio.muted ? '🔇' : '🔊';
                            btn.classList.toggle('muted', this.audio.muted);
                        }
                        if (!this.audio.muted) this.audio.click();
                        break;
                    }
                    case 'cycle-speed': {
                        const order = ['fast', 'normal', 'slow'];
                        const idx = order.indexOf(this.matchSpeed);
                        const next = order[(idx + 1) % order.length];
                        this.setMatchSpeed(next);
                        break;
                    }
                    case 'toggle-pause': {
                        // No-op when no match is running (the button is
                        // disabled in that state anyway).
                        if (!this.isRunning) return;
                        this.togglePause();
                        break;
                    }
                    case 'toggle-debug': {
                        this.debugMode = !this.debugMode;
                        // Reuse the existing debug-clock affordance so the on-pitch
                        // overlay reacts the same way as a triple-click on the clock.
                        const timerEl = document.getElementById('timer');
                        if (timerEl) timerEl.classList.toggle('debug', this.debugMode);
                        const dbgOverlay = document.querySelector('.debug-overlay');
                        if (dbgOverlay) dbgOverlay.style.display = this.debugMode ? 'block' : 'none';
                        break;
                    }
                    case 'show-history': {
                        this._showHistoryModal();
                        break;
                    }
                    case 'reset-career': {
                        const mgr = (typeof GameStorage !== 'undefined') ? GameStorage.loadManager() : null;
                        const who = mgr?.name ? ` for ${mgr.name}` : '';
                        const ok = window.confirm(
                            `Reset career${who}?\n\n` +
                            'This will PERMANENTLY ERASE all historical data — your ' +
                            'manager profile, saved squad, tactics, and match history. ' +
                            'Settings (sound / speed) are kept.\n\n' +
                            'You will be returned to the welcome screen to create a new manager. ' +
                            'Are you sure you want to proceed?'
                        );
                        if (ok && typeof this.resetCareer === 'function') {
                            this.resetCareer();
                        }
                        break;
                    }
                }
            }

            // Match-history modal — two-state. List view (clickable rows) and
            // detail view (full match report). Built ad-hoc on each open so it
            // always reflects the latest persisted data.
            _showHistoryModal() {
                const history = (typeof GameStorage !== 'undefined') ? GameStorage.loadHistory() : [];
                let modal = document.getElementById('historyModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'historyModal';
                    modal.className = 'modal-overlay';
                    document.body.appendChild(modal);
                }
                this._renderHistoryList(modal, history);
                modal.classList.add('active');
                modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
            }

            _renderHistoryList(modal, history) {
                const body = history.length
                    ? history.slice().reverse().map((m, revIdx) => {
                        const realIdx = history.length - 1 - revIdx;
                        const win = m.playerScore > m.cpuScore ? 'W'
                                  : m.playerScore < m.cpuScore ? 'L' : 'D';
                        let dateStr = '';
                        try { dateStr = new Date(m.date).toLocaleString(); } catch (e) { dateStr = m.date || ''; }
                        const scorers = (m.goals || [])
                            .map(g => `${g.scorer || '?'} ${g.minute}'`)
                            .join(', ');
                        return `<div class="tm-hist-row tm-hist-clickable" data-history-idx="${realIdx}" role="button" tabindex="0">
                            <span class="tm-result ${win}">${win}</span>
                            <span class="tm-score">${m.playerScore}–${m.cpuScore}</span>
                            <span class="tm-opponent">${m.cpuTeam || 'Opponent'}</span>
                            <span class="tm-date">${dateStr}</span>
                            ${scorers ? `<div class="tm-scorers">⚽ ${scorers}</div>` : ''}
                        </div>`;
                    }).join('')
                    : `<div class="tm-hist-empty">No matches played yet — finish a match to log it here.</div>`;

                modal.innerHTML = `
                    <div class="modal-card">
                        <div class="modal-head">
                            <span>Match History${history.length ? ` (${history.length})` : ''}</span>
                            <button class="modal-close" aria-label="Close">×</button>
                        </div>
                        <div class="modal-body">${body}</div>
                    </div>`;
                modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
                modal.querySelectorAll('.tm-hist-clickable').forEach(row => {
                    const open = () => {
                        const idx = parseInt(row.dataset.historyIdx, 10);
                        this._renderHistoryDetail(modal, history, idx);
                    };
                    row.addEventListener('click', open);
                    row.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                    });
                });
            }

            _renderHistoryDetail(modal, history, idx) {
                const m = history[idx];
                if (!m) return;
                const win = m.playerScore > m.cpuScore ? 'W'
                          : m.playerScore < m.cpuScore ? 'L' : 'D';
                const dateStr = (() => { try { return new Date(m.date).toLocaleString(); } catch { return m.date || ''; } })();
                const ts = m.teamStats || {};

                // Helper: 0-safe percentage
                const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

                // Per-team match stats table
                const statRow = (label, p, c, suffix = '') => `
                    <div class="tm-stat-row">
                        <span class="tm-stat-num">${p ?? 0}${suffix}</span>
                        <span class="tm-stat-label">${label}</span>
                        <span class="tm-stat-num">${c ?? 0}${suffix}</span>
                    </div>`;
                const teamStatsHtml = `
                    <div class="tm-stat-table">
                        <div class="tm-stat-head">
                            <span>${m.playerTeam || 'You'}</span>
                            <span>Match stats</span>
                            <span>${m.cpuTeam || 'CPU'}</span>
                        </div>
                        ${statRow('Possession', ts.playerPossession ?? 50, ts.cpuPossession ?? 50, '%')}
                        ${statRow('Shots', ts.playerShots, ts.cpuShots)}
                        ${statRow('Shots on target', ts.playerShotsOnTarget, ts.cpuShotsOnTarget)}
                        ${statRow('Passes', ts.playerPasses, ts.cpuPasses)}
                        ${statRow('Pass %', pct(ts.playerPassesCompleted, ts.playerPasses), pct(ts.cpuPassesCompleted, ts.cpuPasses), '%')}
                        ${statRow('Tackles', ts.playerTackles, ts.cpuTackles)}
                        ${statRow('Corners', ts.playerCorners, ts.cpuCorners)}
                        ${statRow('Fouls', ts.playerFouls, ts.cpuFouls)}
                        ${statRow('Offsides', ts.playerOffsides, ts.cpuOffsides)}
                        ${statRow('Free kicks', ts.playerFreeKicks, ts.cpuFreeKicks)}
                    </div>`;

                // Goalscorers timeline
                const goalsHtml = (m.goals || []).length
                    ? `<div class="tm-section-head">Goalscorers</div>
                       <div class="tm-goal-list">
                           ${m.goals.map(g => {
                               const teamLabel = g.team === 'player' ? (m.playerTeam || 'You') : (m.cpuTeam || 'CPU');
                               const assist = g.assister ? ` <span class="tm-assister">(assist: ${g.assister})</span>` : '';
                               return `<div class="tm-goal">
                                   <span class="tm-minute">${g.minute || '?'}'</span>
                                   <span class="tm-team-tag tm-team-${g.team}">${teamLabel}</span>
                                   <span class="tm-scorer">⚽ ${g.scorer || '?'}${assist}</span>
                               </div>`;
                           }).join('')}
                       </div>`
                    : '';

                // Cards
                const allCards = [
                    ...(m.cards?.player || []).map(c => ({ ...c, team: 'player' })),
                    ...(m.cards?.cpu    || []).map(c => ({ ...c, team: 'cpu' })),
                ].sort((a, b) => (a.time || 0) - (b.time || 0));
                const cardsHtml = allCards.length
                    ? `<div class="tm-section-head">Cards</div>
                       <div class="tm-card-list">
                           ${allCards.map(c => {
                               const teamLabel = c.team === 'player' ? (m.playerTeam || 'You') : (m.cpuTeam || 'CPU');
                               const icon = c.type === 'red' ? '🟥' : '🟨';
                               return `<div class="tm-card-row">
                                   <span class="tm-minute">${c.time}'</span>
                                   <span class="tm-team-tag tm-team-${c.team}">${teamLabel}</span>
                                   <span>${icon} ${c.player}</span>
                               </div>`;
                           }).join('')}
                       </div>`
                    : '';

                // Per-player line-ups (top players by rating)
                const lineupHtml = (label, snap) => {
                    if (!snap || !snap.lineup?.length) return '';
                    return `<div class="tm-lineup">
                        <div class="tm-lineup-head">${label}</div>
                        <div class="tm-lineup-row tm-lineup-head-row">
                            <span>#</span><span>Player</span><span title="Position">Pos</span>
                            <span title="Minutes">Min</span>
                            <span title="Goals">G</span><span title="Assists">A</span>
                            <span title="Shots (on target)">Sh</span>
                            <span title="Pass %">P%</span>
                            <span title="Tackles">T</span>
                            <span title="Cards">C</span>
                            <span title="Rating 1-10">Rating</span>
                        </div>
                        ${snap.lineup.map(pl => {
                            const ratingClass = pl.rating >= 8 ? 'r-great' : pl.rating >= 7 ? 'r-good' : pl.rating >= 6 ? 'r-ok' : 'r-poor';
                            const passPct = pl.passes > 0 ? Math.round((pl.passesCompleted / pl.passes) * 100) : 0;
                            const cards = (pl.redCards ? '🟥'.repeat(pl.redCards) : '') + (pl.yellowCards ? '🟨'.repeat(pl.yellowCards) : '') || '·';
                            return `<div class="tm-lineup-row">
                                <span>${pl.number ?? '·'}</span>
                                <span class="tm-pl-name">${pl.name}</span>
                                <span class="tm-pl-pos">${pl.position}</span>
                                <span>${pl.minutes}'</span>
                                <span>${pl.goals || '·'}</span>
                                <span>${pl.assists || '·'}</span>
                                <span>${pl.shots}${pl.shotsOnTarget ? ` (${pl.shotsOnTarget})` : ''}</span>
                                <span>${passPct ? passPct + '%' : '·'}</span>
                                <span>${pl.tackles || '·'}</span>
                                <span class="tm-pl-cards">${cards}</span>
                                <span class="tm-pl-rating ${ratingClass}">${pl.rating ? pl.rating.toFixed(1) : '–'}</span>
                            </div>`;
                        }).join('')}
                    </div>`;
                };

                modal.innerHTML = `
                    <div class="modal-card modal-card-wide">
                        <div class="modal-head">
                            <button class="tm-back-btn" aria-label="Back to list">← Back</button>
                            <span>Match Report</span>
                            <button class="modal-close" aria-label="Close">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="tm-match-head">
                                <div class="tm-match-team">${m.playerTeam || 'You'}</div>
                                <div class="tm-match-score">
                                    <span class="tm-result-big ${win}">${win}</span>
                                    <span>${m.playerScore} – ${m.cpuScore}</span>
                                </div>
                                <div class="tm-match-team">${m.cpuTeam || 'CPU'}</div>
                            </div>
                            <div class="tm-match-sub">${m.playerFormation || ''} vs ${m.cpuFormation || ''} · ${dateStr}</div>
                            ${goalsHtml}
                            ${teamStatsHtml}
                            ${cardsHtml}
                            ${lineupHtml(m.playerTeam || 'You', m.playerLineup)}
                            ${lineupHtml(m.cpuTeam || 'CPU',    m.cpuLineup)}
                        </div>
                    </div>`;
                modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
                modal.querySelector('.tm-back-btn').addEventListener('click', () => this._renderHistoryList(modal, history));
            }

            // ─── First-run onboarding — 4-step wizard ────────────────────────
            // Step 1: manager name · 2: nation · 3: city + map · 4: league.
            // Listeners wired ONCE here so re-showing the overlay (e.g. after
            // a reset) doesn't stack handlers.
            setupOnboarding() {
                const overlay = document.getElementById('onboardingOverlay');
                if (!overlay) return;

                this._onbState = { name: '', nation: null, city: null, league: null };

                // Step 1 — name
                const nameInput = document.getElementById('onboardingNameInput');
                const nameNext  = document.getElementById('onboardingNextBtn');
                if (nameInput && nameNext) {
                    nameInput.addEventListener('input', () => {
                        nameNext.disabled = !nameInput.value.trim();
                    });
                    nameInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !nameNext.disabled) nameNext.click();
                    });
                    nameNext.addEventListener('click', () => {
                        this._onbState.name = nameInput.value.trim();
                        if (!this._onbState.name) return;
                        this._renderNationStep();
                        this._setOnbStep('nation');
                    });
                }

                // Step 2 — nation
                const nationNext = document.getElementById('nationNextBtn');
                if (nationNext) {
                    nationNext.addEventListener('click', () => {
                        if (!this._onbState.nation) return;
                        this._renderCityStep();
                        this._setOnbStep('city');
                    });
                }

                // Step 3 — city
                const cityNext = document.getElementById('cityNextBtn');
                if (cityNext) {
                    cityNext.addEventListener('click', () => {
                        if (!this._onbState.nation || !this._onbState.city) return;
                        // Generate the league using the nation + chosen city
                        this._onbState.league = (typeof LeagueGenerator !== 'undefined')
                            ? LeagueGenerator.generateLeague(this._onbState.nation, this._onbState.city.name)
                            : [];
                        this._renderLeagueStep();
                        this._setOnbStep('league');
                    });
                }

                // Step 4 — confirm
                const leagueConfirm = document.getElementById('leagueConfirmBtn');
                if (leagueConfirm) {
                    leagueConfirm.addEventListener('click', () => this._completeOnboarding());
                }

                // Back buttons (data-onb-back="<step>")
                overlay.querySelectorAll('[data-onb-back]').forEach(btn => {
                    btn.addEventListener('click', () => this._setOnbStep(btn.dataset.onbBack));
                });
            }

            _setOnbStep(step) {
                const overlay = document.getElementById('onboardingOverlay');
                if (!overlay) return;
                overlay.querySelectorAll('.onboarding-step').forEach(el => {
                    el.classList.toggle('active', el.dataset.step === step);
                });
            }

            _showOnboarding() {
                const overlay = document.getElementById('onboardingOverlay');
                if (!overlay) return;
                // Reset wizard to step 1 with a clean slate
                this._onbState = { name: '', nation: null, city: null, league: null };
                const nameInput = document.getElementById('onboardingNameInput');
                const nameNext  = document.getElementById('onboardingNextBtn');
                if (nameInput) {
                    nameInput.value = '';
                    setTimeout(() => nameInput.focus(), 60);
                }
                if (nameNext) nameNext.disabled = true;
                this._setOnbStep('name');
                overlay.classList.add('active');
                overlay.setAttribute('aria-hidden', 'false');
                // Close the hamburger if open
                const drop = document.getElementById('topMenuDropdown');
                const hamb = document.getElementById('hamburgerBtn');
                if (drop) drop.style.display = 'none';
                if (hamb) hamb.setAttribute('aria-expanded', 'false');
            }

            // Step 2 — render the 11-nation grid
            _renderNationStep() {
                const grid = document.getElementById('nationGrid');
                const next = document.getElementById('nationNextBtn');
                if (!grid || typeof SEA_NATIONS === 'undefined') return;
                grid.innerHTML = SEA_NATIONS.map(n => `
                    <button class="nation-btn" data-nation-code="${n.code}">
                        <span class="nation-flag">${n.flag}</span>
                        <span class="nation-name">${n.name}</span>
                    </button>
                `).join('');
                grid.querySelectorAll('.nation-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const code = btn.dataset.nationCode;
                        this._onbState.nation = SEA_NATIONS.find(n => n.code === code);
                        this._onbState.city = null;
                        grid.querySelectorAll('.nation-btn').forEach(b => b.classList.toggle('selected', b === btn));
                        if (next) next.disabled = false;
                    });
                });
                if (next) next.disabled = !this._onbState.nation;
                // Pre-select if we're stepping back to this view
                if (this._onbState.nation) {
                    const sel = grid.querySelector(`[data-nation-code="${this._onbState.nation.code}"]`);
                    if (sel) sel.classList.add('selected');
                }
            }

            // Step 3 — city list + interactive map
            _renderCityStep() {
                const nation = this._onbState.nation;
                if (!nation) return;
                const title = document.getElementById('cityStepTitle');
                if (title) title.textContent = `Pick your home city — ${nation.flag} ${nation.name}`;

                const list = document.getElementById('cityList');
                const next = document.getElementById('cityNextBtn');
                const map  = document.getElementById('countryMap');
                if (!list || !map || !next) return;

                // City list
                list.innerHTML = nation.cities.map(c => `
                    <button class="city-item" data-city-name="${c.name}">${c.name}</button>
                `).join('');

                // Map SVG: country outline + city dots
                map.innerHTML = `
                    <polygon class="map-outline" points="${nation.outline}"/>
                    ${nation.cities.map(c => `
                        <g class="map-city" data-city-name="${c.name}" tabindex="0">
                            <circle class="map-dot" cx="${c.x}" cy="${c.y}" r="1.4"/>
                            <text class="map-label" x="${c.x + 2}" y="${c.y + 1}">${c.name}</text>
                        </g>
                    `).join('')}
                `;

                const selectCity = (name) => {
                    const city = nation.cities.find(c => c.name === name);
                    if (!city) return;
                    this._onbState.city = city;
                    list.querySelectorAll('.city-item').forEach(el =>
                        el.classList.toggle('selected', el.dataset.cityName === name));
                    map.querySelectorAll('.map-city').forEach(el =>
                        el.classList.toggle('selected', el.dataset.cityName === name));
                    map.querySelectorAll('.map-city .map-dot').forEach(el => {
                        const parent = el.parentNode;
                        el.setAttribute('r', parent.classList.contains('selected') ? '2.2' : '1.4');
                    });
                    next.disabled = false;
                };
                list.querySelectorAll('.city-item').forEach(el => {
                    el.addEventListener('click', () => selectCity(el.dataset.cityName));
                });
                map.querySelectorAll('.map-city').forEach(el => {
                    el.addEventListener('click', () => selectCity(el.dataset.cityName));
                    el.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectCity(el.dataset.cityName);
                        }
                    });
                });

                next.disabled = !this._onbState.city;
                if (this._onbState.city) selectCity(this._onbState.city.name);
            }

            // Step 4 — preview league table, awaiting confirm
            _renderLeagueStep() {
                const wrap = document.getElementById('leaguePreview');
                const intro = document.getElementById('leagueIntro');
                if (!wrap) return;
                const clubs = this._onbState.league || [];
                if (intro && this._onbState.nation) {
                    intro.textContent = `Here are the 10 ${this._onbState.nation.name} clubs you'll be competing with this season. Yours is highlighted.`;
                }
                const ordered = (typeof LeagueGenerator !== 'undefined')
                    ? LeagueGenerator.sortTable(clubs)
                    : clubs.slice();
                wrap.innerHTML = `
                    <div class="league-row header">
                        <span class="lp-num">#</span>
                        <span></span>
                        <span class="lp-name">Club</span>
                        <span class="lp-num">P</span>
                        <span class="lp-num">W</span>
                        <span class="lp-num">D</span>
                        <span class="lp-num">L</span>
                        <span class="lp-num">GF:GA</span>
                        <span class="lp-num">Pts</span>
                    </div>
                    ${ordered.map((c, i) => `
                        <div class="league-row ${c.isUserClub ? 'user-club' : ''}">
                            <span class="lp-num">${i + 1}</span>
                            <span class="lp-crest" style="background:${c.jerseyColor};"></span>
                            <span class="lp-name">${c.clubName}</span>
                            <span class="lp-num">${c.played}</span>
                            <span class="lp-num">${c.wins}</span>
                            <span class="lp-num">${c.draws}</span>
                            <span class="lp-num">${c.losses}</span>
                            <span class="lp-num">${c.goalsFor}:${c.goalsAgainst}</span>
                            <span class="lp-num">${c.points}</span>
                        </div>
                    `).join('')}
                `;
            }

            _completeOnboarding() {
                const { name, nation, city, league } = this._onbState || {};
                if (!name || !nation || !city) return;
                const userClub = (league || []).find(c => c.isUserClub) || null;

                if (typeof GameStorage !== 'undefined') {
                    GameStorage.saveManager({
                        name,
                        nation:   nation.code,
                        nationName: nation.name,
                        nationFlag: nation.flag,
                        city:     city.name,
                        clubName: userClub?.clubName || `${city.name} FC`,
                        createdAt: new Date().toISOString(),
                    });
                    if (league) {
                        // Populate every non-user club's persistent player roster
                        // so simulated CPU-vs-CPU matches can attribute scorers
                        // and assists for the league-wide leaderboard.
                        if (typeof LeagueGenerator !== 'undefined') {
                            league.forEach(c => {
                                if (!c.isUserClub) LeagueGenerator.ensureRoster(c, nation);
                            });
                        }
                        GameStorage.saveLeague(league);
                    }
                    // Generate the round-robin fixture list + assign calendar
                    // dates starting at the nation's typical kickoff. In-game
                    // "current date" is set one week before round 1.
                    if (league && typeof LeagueGenerator !== 'undefined') {
                        const kickoff  = LeagueGenerator.nextKickoffDate(nation, new Date());
                        let fixtures = LeagueGenerator.generateFixtures(league);
                        if (kickoff) fixtures = LeagueGenerator.scheduleFixtures(fixtures, kickoff);
                        GameStorage.saveFixtures(fixtures);
                        if (kickoff) {
                            const cur = new Date(kickoff);
                            cur.setDate(cur.getDate() - 7);
                            GameStorage.saveCurrentDate(cur.toISOString().slice(0, 10));
                        }
                    }
                }

                // Adopt the new club's identity for the player team (kit + crest)
                // and rebuild the squad to reflect the chosen nation and the
                // club's budget (so most players are local, with a few imports
                // and a quality spread driven by city budget).
                if (this.playerTeam && userClub) {
                    this.playerTeam.clubName    = userClub.clubName;
                    this.playerTeam.jerseyColor = userClub.jerseyColor;
                    this.playerTeam.crestSeed   = userClub.crestSeed;
                    this.playerTeam.homeNation  = nation;
                    this.playerTeam.budget      = userClub.budget;
                    if (typeof CrestGenerator !== 'undefined') {
                        this.playerTeam.crestSVG   = CrestGenerator.generateSVG(userClub.crestSeed, userClub.jerseyColor, 70);
                        this.playerTeam.crestSVGSm = CrestGenerator.generateSVG(userClub.crestSeed, userClub.jerseyColor, 44);
                    }
                    this.playerTeam.regenerateRoster();
                    // regenerateRoster clears startingXI / bench / onField — re-pick
                    // the XI so the Clubhouse squad view groups players correctly
                    // (Starting XI / Bench / Reserves) rather than dumping everyone
                    // into the Reserves bucket.
                    this.playerTeam.setupSquad(this.playerFormation);
                    GameStorage?.savePlayerTeam?.(this.playerTeam.serialize());
                }

                const overlay = document.getElementById('onboardingOverlay');
                if (overlay) {
                    overlay.classList.remove('active');
                    overlay.setAttribute('aria-hidden', 'true');
                }
                this._refreshManagerLabel();
                this._refreshDateLabel();
                // Land on the Clubhouse, not the formation pick
                this._enterClubhouse();
                console.log(`Career started: ${name} · ${nation.name} · ${userClub?.clubName || city.name}`);
            }

            // Updates the manager slot in the top bar (right of the brand title,
            // left of the hamburger). Hidden when no manager profile exists.
            _refreshManagerLabel() {
                const slot = document.getElementById('topMenuManager');
                if (!slot) return;
                const mgr = (typeof GameStorage !== 'undefined') ? GameStorage.loadManager() : null;
                if (!mgr?.name) {
                    slot.innerHTML = '';
                    return;
                }
                const club = mgr.clubName ? `<span class="tmm-sep">·</span><span class="tmm-club">${mgr.clubName}</span>` : '';
                slot.innerHTML = `<span class="tmm-mgr">${mgr.name}</span>${club}`;
            }

            // Renders the in-game date into the top bar. Hidden if no career is
            // running (pre-onboarding boot, just after a wipe, etc.).
            _refreshDateLabel() {
                const slot = document.getElementById('topMenuDate');
                if (!slot) return;
                const iso = (typeof GameStorage !== 'undefined') ? GameStorage.loadCurrentDate() : null;
                slot.textContent = iso ? this._formatDate(iso) : '';
            }

            // YYYY-MM-DD → "Sat, 14 Feb 2027". Used by top-bar date + match
            // preview header. Robust to invalid inputs (returns the raw string).
            _formatDate(iso) {
                const d = new Date(iso);
                if (isNaN(d.getTime())) return iso || '';
                const opts = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
                return d.toLocaleDateString('en-GB', opts);
            }

            // ─── Clubhouse ───────────────────────────────────────────────────
            // Post-onboarding home base — left menu + stadium illustration.
            // Menu items link to existing screens (management / match) plus the
            // shared modals (history / league table).
            _enterClubhouse() {
                const mgr = (typeof GameStorage !== 'undefined') ? GameStorage.loadManager() : null;
                if (!mgr) return;
                // Block clubhouse access while a match is in progress — the
                // user must finish (or the match must end) before returning.
                if (this._inMatch) {
                    console.warn('_enterClubhouse blocked: match in progress');
                    return;
                }

                // Header — club crest + name + sub-line
                const crestSlot = document.getElementById('chCrestSlot');
                if (crestSlot && this.playerTeam?.crestSVG) {
                    crestSlot.innerHTML = this.playerTeam.crestSVG;
                }
                const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
                const clubName = this.playerTeam?.clubName || mgr.clubName || 'Your Club';
                const subLine  = `${mgr.nationFlag || ''} ${mgr.city || ''}${mgr.city ? ' · ' : ''}${mgr.nationName || ''}`.trim();
                setText('chClubName',   clubName);
                setText('chClubSub',    subLine);
                setText('chBannerName', clubName);
                setText('chBannerSub',  subLine);

                // Stadium illustration (built once per render to reflect kit colour)
                this._renderStadiumSVG(this.playerTeam?.jerseyColor || '#FFD700');

                // Wire menu buttons (idempotent — re-attached each render).
                // Picks up both the desktop rail items and the mobile bottom-sheet
                // copies — they share class + data-clubhouse-action. Tapping any
                // item closes the mobile sheet (no-op on desktop).
                document.querySelectorAll('.ch-menu-item').forEach(btn => {
                    const fresh = btn.cloneNode(true);
                    btn.parentNode.replaceChild(fresh, btn);
                    fresh.addEventListener('click', () => {
                        this._closeClubhouseMenu();
                        this._handleClubhouseAction(fresh.dataset.clubhouseAction);
                    });
                });

                // Wire the mobile app footer (menu toggle + back/fwd nav).
                this._wireClubhouseMobileFooter();

                // Default to the stadium view + highlight the Stadium menu item.
                // Seed the nav stack with this entry so Back goes nowhere yet
                // but Forward will work after the next navigation.
                this._navigateTo('🏟️ Stadium', () => {
                    this.switchScreen('clubhouseScreen');
                    this._setClubhouseView('stadium');
                });
            }

            _handleClubhouseAction(action) {
                if (this._inMatch) {
                    console.warn('Clubhouse action blocked mid-match:', action);
                    return;
                }
                switch (action) {
                    case 'home':
                        this._navigateTo('🏟️ Stadium', () => this._setClubhouseView('stadium'));
                        break;
                    case 'squad':
                        this._navigateTo('👥 Squad', () => {
                            this._setClubhouseView('squad');
                            this._renderClubhouseSquad();
                        });
                        break;
                    case 'tactics':
                        // Independent Match Management screen — adjusting tactics
                        // from the Clubhouse (mode = 'tactics' → Back to Clubhouse).
                        this._navigateTo('📋 Tactics & XI', () => this._openTacticsView('tactics'));
                        break;
                    case 'play':
                        this._navigateTo('⚽ Next Match', () => {
                            this._setClubhouseView('next-match');
                            this._renderNextMatchView();
                        });
                        break;
                    case 'history':
                        this._showHistoryModal();
                        break;
                    case 'league':
                        this._navigateTo('🏆 League Table', () => {
                            this._setClubhouseView('league');
                            this._renderClubhouseLeague();
                        });
                        break;
                    case 'fixtures':
                        this._navigateTo('📅 Fixtures', () => {
                            this._setClubhouseView('fixtures');
                            this._renderClubhouseFixtures();
                        });
                        break;
                    case 'office':
                        alert(`Manager's office — coming soon.\n\nProfile: ${(GameStorage?.loadManager()?.name) || '—'}`);
                        break;
                }
            }

            // Mobile-only: wires the bottom app footer.
            //   - Left half (#chMobileMenuBtn) toggles the bottom-sheet menu
            //   - Right half (#mobileNavBackBtn / #mobileNavFwdBtn) drives the
            //     same _navBack/_navForward as the desktop nav pill
            //   - Backdrop tap closes the sheet
            // Listeners are re-attached via clone to stay idempotent across
            // repeated _enterClubhouse() calls.
            _wireClubhouseMobileFooter() {
                const menuBtn  = document.getElementById('chMobileMenuBtn');
                const sheet    = document.getElementById('chMobileMenuSheet');
                const backdrop = document.getElementById('chMobileMenuBackdrop');
                if (menuBtn && sheet && backdrop) {
                    const freshMenu = menuBtn.cloneNode(true);
                    menuBtn.parentNode.replaceChild(freshMenu, menuBtn);
                    freshMenu.addEventListener('click', () => {
                        const open = !sheet.classList.contains('is-open');
                        sheet.classList.toggle('is-open', open);
                        backdrop.classList.toggle('is-open', open);
                        freshMenu.setAttribute('aria-expanded', String(open));
                        sheet.setAttribute('aria-hidden', String(!open));
                    });
                    const freshBackdrop = backdrop.cloneNode(true);
                    backdrop.parentNode.replaceChild(freshBackdrop, backdrop);
                    freshBackdrop.addEventListener('click', () => this._closeClubhouseMenu());
                }

                // Mobile nav buttons — re-clone to avoid stacking listeners.
                const back = document.getElementById('mobileNavBackBtn');
                const fwd  = document.getElementById('mobileNavFwdBtn');
                if (back) {
                    const freshBack = back.cloneNode(true);
                    back.parentNode.replaceChild(freshBack, back);
                    freshBack.addEventListener('click', () => this._navBack());
                }
                if (fwd) {
                    const freshFwd = fwd.cloneNode(true);
                    fwd.parentNode.replaceChild(freshFwd, fwd);
                    freshFwd.addEventListener('click', () => this._navForward());
                }
                // Sync state on (re)wire so disabled flags + label match the stack.
                this._refreshNavButtons();
            }

            _closeClubhouseMenu() {
                const sheet    = document.getElementById('chMobileMenuSheet');
                const backdrop = document.getElementById('chMobileMenuBackdrop');
                const menuBtn  = document.getElementById('chMobileMenuBtn');
                sheet?.classList.remove('is-open');
                backdrop?.classList.remove('is-open');
                sheet?.setAttribute('aria-hidden', 'true');
                menuBtn?.setAttribute('aria-expanded', 'false');
            }

            // ─── Auto-substitution policies ─────────────────────────────────
            // Three policies stored under this.tactics.autoSubs:
            //   onInjury:    'on'  | 'off'
            //   onStamina:   'off' | 'low' (<60) | 'critical' (<40)
            //   onPerformance: 'off' | 'low' (<6.0) | 'critical' (<5.0)
            // Evaluation runs each event tick (throttled), picks the best bench
            // replacement, and executes the sub via _executeAutoSub.

            _setAutoSub(key, value) {
                if (!this.tactics.autoSubs) {
                    this.tactics.autoSubs = { onInjury: 'on', onStamina: 'off', onPerformance: 'off' };
                }
                this.tactics.autoSubs[key] = value;
                if (typeof GameStorage !== 'undefined') {
                    GameStorage.saveTactics(this.tactics, this.playerFormation);
                }
                this.renderManagementPanel();
            }

            // Periodic poll — called from runMatch's event tick. Throttled to
            // one evaluation every ~5 in-game minutes to avoid thrashing.
            _evaluateAutoSubs() {
                if (!this.isRunning || this.isPaused) return;
                if (this.matchFlow?._kickoffMode) return;
                if (!this.playerTeam || !this.cpuTeam) return;
                if (!this.rules?.canSubstitute('player')) return;
                if (!this.playerTeam.bench?.length) return;

                const policy = this.tactics?.autoSubs || {};
                const stamThreshold = policy.onStamina === 'low' ? 60
                                    : policy.onStamina === 'critical' ? 40 : null;
                const perfThreshold = policy.onPerformance === 'low' ? 6.0
                                    : policy.onPerformance === 'critical' ? 5.0 : null;
                if (!stamThreshold && !perfThreshold) return;

                const minute = this.rules.getMatchMinute(this.timeRemaining);
                if (this._lastAutoSubCheck != null && (minute - this._lastAutoSubCheck) < 5) return;
                this._lastAutoSubCheck = minute;

                for (const p of this.playerTeam.onField) {
                    if (!this.rules.canSubstitute('player')) break;
                    if (p.position === 'GK') continue;       // never auto-sub the keeper
                    const liveMins = this._liveMinutesPlayed(p);
                    if (liveMins < 20) continue;             // give them time first

                    let reason = null;
                    if (stamThreshold && (p.condition ?? 100) < stamThreshold) {
                        reason = `stamina ${Math.round(p.condition ?? 100)}%`;
                    }
                    if (!reason && perfThreshold && liveMins >= 30) {
                        // Bump banked minutes so the rating function (which
                        // does its own >= 5 minutes check on stats.minutesPlayed)
                        // sees the live count.
                        const banked = p.stats.minutesPlayed;
                        p.stats.minutesPlayed = liveMins;
                        const rating = this._computePlayerRating(p, undefined, this.cpuScore);
                        p.stats.minutesPlayed = banked;
                        if (rating > 0 && rating < perfThreshold) {
                            reason = `rating ${rating.toFixed(1)}`;
                        }
                    }
                    if (!reason) continue;

                    const replacement = this._pickAutoSubReplacement(p);
                    if (!replacement) continue;

                    this._executeAutoSub(p, replacement, reason, minute);
                    return; // one sub per evaluation tick
                }
            }

            // Bench-replacement picker: same natural position first, then same
            // position family, then best-overall non-GK fallback. Excludes GKs
            // since we never auto-sub the keeper.
            _pickAutoSubReplacement(playerOut) {
                const bench = this.playerTeam?.bench || [];
                if (!bench.length) return null;
                const FAMILY = {
                    CB:'def', LB:'def', RB:'def', LWB:'def', RWB:'def',
                    CDM:'def', CM:'mid', CAM:'mid', LM:'wide', RM:'wide',
                    LW:'wide', RW:'wide', ST:'fwd', CF:'fwd',
                };
                const bestBy = (pool) => pool.slice().sort((a, b) => this.calculateOverall(b) - this.calculateOverall(a))[0] || null;

                const sameNatural = bench.filter(b => b.naturalPosition === playerOut.naturalPosition);
                if (sameNatural.length) return bestBy(sameNatural);

                const fam = FAMILY[playerOut.naturalPosition];
                const sameFamily = bench.filter(b => b.naturalPosition !== 'GK' && FAMILY[b.naturalPosition] === fam);
                if (sameFamily.length) return bestBy(sameFamily);

                const others = bench.filter(b => b.naturalPosition !== 'GK');
                return bestBy(others);
            }

            // Mirror of confirmSubstitution but driven by the auto-sub policy.
            // Asymmetry preserved: incoming player goes onField as a spread copy
            // with isOnField:true; outgoing keeps its original reference on the
            // bench so its stats survive intact.
            _executeAutoSub(playerOut, playerIn, reason, minute) {
                const outIndex = this.playerTeam.onField.findIndex(p => p.id === playerOut.id);
                if (outIndex === -1) return;
                this.playerTeam.onField[outIndex] = { ...playerIn, isOnField: true };
                const inIndex = this.playerTeam.bench.findIndex(p => p.id === playerIn.id);
                if (inIndex !== -1) this.playerTeam.bench[inIndex] = playerOut;
                playerOut.position = playerOut.naturalPosition || playerOut.position;
                this.playerTeam.assignSlotPositions(this.playerFormation);

                this.rules.recordSub('player');
                this.substitutions.push({ team: 'player', playerOut: playerOut.name, playerIn: playerIn.name, time: `${minute}'` });
                this.addEvent(
                    `🤖 Auto-sub (${minute}'): <b class="ev-name">${playerOut.name}</b> off — ${reason}. <b class="ev-name">${playerIn.name}</b> on.`,
                    'tackle', 'player', 'medium'
                );
                this._statSubOff(playerOut);
                this._statSubOn(playerIn);
                this._refreshMatchFlowPlayerInfo();
                this.renderManagementPanel();
                this._renderSubsStrip?.();   // instant chip update, don't wait a tick
            }

            // Wire delegated click handlers for every mounted .mgmt-panel.
            // Formation + tactic buttons are inside each panel scope, so we
            // bind once at boot per panel root via event delegation. Keeps
            // the two scopes (managementScreen / clubhouse Tactic) isolated.
            _wireMgmtPanelHandlers() {
                document.querySelectorAll('.mgmt-panel').forEach(scope => {
                    scope.addEventListener('click', (e) => {
                        const fb = e.target.closest('.formation-btn');
                        if (fb) {
                            // Existing selectFormation expects a button element.
                            // It reads dataset.formation — same shape as before.
                            this.selectFormation(fb);
                            return;
                        }
                        const tb = e.target.closest('.tactic-btn');
                        if (tb && tb.dataset.tactic) {
                            this.setTactic(tb.dataset.tactic, tb.dataset.value);
                            return;
                        }
                        // Auto-sub policy buttons share the .tactic-btn style
                        // but carry data-autosub instead of data-tactic.
                        if (tb && tb.dataset.autosub) {
                            this._setAutoSub(tb.dataset.autosub, tb.dataset.value);
                            return;
                        }
                        const closeX = e.target.closest('.player-detail-close-btn');
                        if (closeX) {
                            const overlay = scope.querySelector('.player-detail-overlay');
                            if (overlay) overlay.style.display = 'none';
                            return;
                        }
                    });
                });
            }

            // Returns the active .mgmt-panel scope — the one inside whichever
            // host is currently visible. Used by render functions so they
            // operate on the right DOM tree.
            _getActiveMgmtScope() {
                // Match Management screen takes priority while visible.
                const mgmtScreen = document.getElementById('managementScreen');
                if (mgmtScreen?.classList.contains('active')) {
                    return mgmtScreen.querySelector('.mgmt-panel');
                }
                // Otherwise: whichever ch-view-tactic is active in clubhouse.
                const tacticView = document.querySelector('.ch-view-tactic.active');
                if (tacticView) return tacticView.querySelector('.mgmt-panel');
                // Fallback: first panel on the page.
                return document.querySelector('.mgmt-panel');
            }

            // Open the management UI. Modes:
            //   'tactics' — embedded in the Clubhouse Tactic view (auto-saves
            //               on Back to Clubhouse via the menu).
            //   'kickoff' — Match Management screen, primary action Kick Off.
            //   'inMatch' — Match Management screen, primary action Resume.
            //               Clubhouse access is blocked while in this mode.
            _openTacticsView(mode = 'tactics') {
                this._mgmtMode = mode;
                if (mode === 'tactics') {
                    // Embedded clubhouse view — no separate screen switch.
                    this.switchScreen('clubhouseScreen');
                    this._setClubhouseView('tactic');
                } else {
                    this.switchScreen('managementScreen');
                }
                this.renderManagementPanel();
            }

            // Toggles which right-pane view is visible and which menu item is
            // highlighted. Used for the inline (in-pane) clubhouse content
            // — Stadium / League / Fixtures / Squad / Tactics.
            _setClubhouseView(viewName) {
                document.querySelectorAll('.ch-view').forEach(el => {
                    el.classList.toggle('active', el.dataset.view === viewName);
                });
                const menuKey = viewName === 'stadium' ? 'home' : viewName;
                document.querySelectorAll('.ch-menu-item').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.clubhouseAction === menuKey);
                });
            }

            // Renders the league table inline in the clubhouse right pane.
            // Pulls from GameStorage.loadLeague() so updates after matches
            // are reflected; falls back to a friendly empty state.
            _renderClubhouseLeague() {
                const body = document.getElementById('chLeagueBody');
                if (!body) return;
                const league = (typeof GameStorage !== 'undefined') ? GameStorage.loadLeague() : null;
                if (!league || !league.length) {
                    body.innerHTML = `<div class="tm-hist-empty">No league generated yet.</div>`;
                    return;
                }
                const ordered = (typeof LeagueGenerator !== 'undefined')
                    ? LeagueGenerator.sortTable(league)
                    : league.slice();

                const { topScorers, topAssists } = this._aggregateTopScorersAndAssists();
                const userClubName = ordered.find(c => c.isUserClub)?.clubName;

                const statTable = (title, rows, statLabel) => {
                    if (!rows.length) {
                        return `<div class="ch-stat-table">
                            <div class="ch-stat-head">${title}</div>
                            <div class="tm-hist-empty" style="padding:12px;">No data yet — play a match first.</div>
                        </div>`;
                    }
                    return `<div class="ch-stat-table">
                        <div class="ch-stat-head">${title}</div>
                        <div class="ch-stat-row header">
                            <span class="cs-num">#</span>
                            <span class="cs-name">Player</span>
                            <span class="cs-club">Club</span>
                            <span class="cs-num">${statLabel}</span>
                        </div>
                        ${rows.map((r, i) => `
                            <div class="ch-stat-row ${r.clubName === userClubName ? 'user-club' : ''}">
                                <span class="cs-num">${i + 1}</span>
                                <span class="cs-name">${r.name}</span>
                                <span class="cs-club">${r.clubName}</span>
                                <span class="cs-num">${r.value}</span>
                            </div>
                        `).join('')}
                    </div>`;
                };

                body.innerHTML = `
                    <div class="league-preview" style="max-height:none;">
                        <div class="league-row header">
                            <span class="lp-num">#</span><span></span><span class="lp-name">Club</span>
                            <span class="lp-num">P</span><span class="lp-num">W</span><span class="lp-num">D</span>
                            <span class="lp-num">L</span><span class="lp-num">GF:GA</span><span class="lp-num">Pts</span>
                        </div>
                        ${ordered.map((c, i) => `
                            <div class="league-row ${c.isUserClub ? 'user-club' : ''}">
                                <span class="lp-num">${i + 1}</span>
                                <span class="lp-crest" style="background:${c.jerseyColor};"></span>
                                <span class="lp-name">${c.clubName}</span>
                                <span class="lp-num">${c.played}</span>
                                <span class="lp-num">${c.wins}</span>
                                <span class="lp-num">${c.draws}</span>
                                <span class="lp-num">${c.losses}</span>
                                <span class="lp-num">${c.goalsFor}:${c.goalsAgainst}</span>
                                <span class="lp-num">${c.points}</span>
                            </div>
                        `).join('')}
                    </div>

                    ${statTable('🥇 Top Scorers',  topScorers, 'G')}
                    ${statTable('🎯 Top Assists', topAssists, 'A')}
                `;
            }

            // Aggregates per-player career goals + assists across every club
            // in the league. Reads from each club's persistent `players[]`
            // roster (populated by LeagueGenerator.ensureRoster at onboarding
            // or lazily on first need). User's club roster is read from the
            // saved playerTeam instead, since that's where the user's roster
            // edits + match increments land.
            // Returns sorted top-N lists ({ name, clubName, value }).
            _aggregateTopScorersAndAssists({ limit = 10 } = {}) {
                if (typeof GameStorage === 'undefined') return { topScorers: [], topAssists: [] };
                const league      = GameStorage.loadLeague?.() || [];
                const userSaved   = GameStorage.loadPlayerTeam?.();
                const userClub    = league.find(c => c.isUserClub);
                const userClubName= userClub?.clubName;

                const goals   = new Map();
                const assists = new Map();
                const bump = (map, name, clubName, n) => {
                    if (!name || !n) return;
                    const key = `${clubName}::${name}`;
                    const cur = map.get(key) || { name, clubName, value: 0 };
                    cur.value += n;
                    map.set(key, cur);
                };

                league.forEach(club => {
                    // User's club uses the saved playerTeam roster as the source
                    // of truth — that's where the live match writes career stats.
                    const roster = club.isUserClub
                        ? (userSaved?.players || [])
                        : (club.players || []);
                    roster.forEach(p => {
                        bump(goals,   p.name, club.clubName, p.goals   || 0);
                        bump(assists, p.name, club.clubName, p.assists || 0);
                    });
                });

                // Fallback for very fresh saves where no league/rosters exist yet
                // — fall back to the previous history-snapshot aggregation so the
                // first match's data shows up too.
                if (goals.size === 0 && assists.size === 0) {
                    const history = GameStorage.loadHistory?.() || [];
                    history.forEach(m => {
                        [m.playerLineup, m.cpuLineup].forEach(snap => {
                            if (!snap?.lineup) return;
                            snap.lineup.forEach(p => {
                                bump(goals,   p.name, snap.clubName, p.goals   || 0);
                                bump(assists, p.name, snap.clubName, p.assists || 0);
                            });
                        });
                    });
                }

                const sortDesc = (a, b) => b.value - a.value || a.name.localeCompare(b.name);
                void userClubName; // referenced via map keys; preserved for future filtering
                return {
                    topScorers: [...goals.values()].sort(sortDesc).slice(0, limit),
                    topAssists: [...assists.values()].sort(sortDesc).slice(0, limit),
                };
            }

            // Renders the round-robin fixture list inline in the clubhouse right pane,
            // grouped by round. User's club rows are highlighted gold; played fixtures
            // show the final score in place of the vs separator.
            _renderClubhouseFixtures() {
                const body = document.getElementById('chFixturesBody');
                if (!body) return;
                const fixtures = (typeof GameStorage !== 'undefined') ? GameStorage.loadFixtures() : null;
                const league   = (typeof GameStorage !== 'undefined') ? GameStorage.loadLeague() : [];
                const currentISO = (typeof GameStorage !== 'undefined') ? GameStorage.loadCurrentDate() : null;
                const userClubName = (league || []).find(c => c.isUserClub)?.clubName || null;

                if (!fixtures || !fixtures.length) {
                    body.innerHTML = `<div class="tm-hist-empty">No fixtures generated yet.</div>`;
                    return;
                }

                // Classify each round: past (all matches played), today (the
                // current in-game date matches this round's date), or upcoming.
                const roundClass = (rd) => {
                    const allPlayed = rd.matches.every(m => m.played);
                    if (rd.date && currentISO && rd.date === currentISO) return 'today';
                    if (allPlayed) return 'past';
                    return 'upcoming';
                };

                body.innerHTML = fixtures.map(rd => {
                    const cls = roundClass(rd);
                    const tag = cls === 'today' ? `<span class="ch-fix-tag">TODAY</span>` : '';
                    const dateLabel = rd.date
                        ? `<span class="ch-fix-date">${this._formatDate(rd.date)}</span>` : '';
                    return `<div class="ch-fix-round ${cls}">
                        <div class="ch-fix-round-head">Round ${rd.round}${tag}${dateLabel}</div>
                        ${rd.matches.map(m => {
                            const isUser = userClubName && (m.home === userClubName || m.away === userClubName);
                            const vsLabel = m.played
                                ? `${m.homeScore ?? 0} – ${m.awayScore ?? 0}`
                                : 'vs';
                            return `<div class="ch-fix-match ${isUser ? 'user-club' : ''} ${m.played ? 'played' : ''}">
                                <span class="ch-fix-home">${m.home}</span>
                                <span class="ch-fix-vs">${vsLabel}</span>
                                <span class="ch-fix-away">${m.away}</span>
                            </div>`;
                        }).join('')}
                    </div>`;
                }).join('');
            }

            // ─── Next-match preview ────────────────────────────────────
            // Walks the saved fixture list, picks the first unplayed match
            // involving the user club, and renders the matchup card + Play
            // button. The Play button triggers the fast-forward overlay.
            _findNextUserFixture() {
                const fixtures = (typeof GameStorage !== 'undefined') ? GameStorage.loadFixtures() : null;
                const league   = (typeof GameStorage !== 'undefined') ? GameStorage.loadLeague() : [];
                const userClub = (league || []).find(c => c.isUserClub) || null;
                if (!fixtures || !userClub) return null;
                for (const rd of fixtures) {
                    const m = (rd.matches || []).find(x => !x.played &&
                        (x.home === userClub.clubName || x.away === userClub.clubName));
                    if (m) return { round: rd.round, date: rd.date, match: m, league, userClub };
                }
                return null;
            }

            _renderNextMatchView() {
                const body = document.getElementById('chNextMatchBody');
                if (!body) return;
                const next = this._findNextUserFixture();
                if (!next) {
                    body.innerHTML = `<div class="ch-nm-empty">No more fixtures this season. Reset career to start a new season.</div>`;
                    return;
                }
                const { round, date, match, league, userClub } = next;
                const homeClub = league.find(c => c.clubName === match.home) || null;
                const awayClub = league.find(c => c.clubName === match.away) || null;
                const userIsHome = match.home === userClub.clubName;
                const venue      = `${homeClub?.cityName || match.home} Stadium`;
                const competition = this._currentCompetitionName();
                const crest = (c) => (c && typeof CrestGenerator !== 'undefined')
                    ? CrestGenerator.generateSVG(c.crestSeed, c.jerseyColor, 84)
                    : '';

                body.innerHTML = `
                    <div class="ch-nm-round"><b>Round ${round}</b>${date ? ' · ' + this._formatDate(date) : ''}</div>
                    <div class="ch-nm-matchup">
                        <div class="ch-nm-team home ${userIsHome ? 'user' : ''}">
                            ${crest(homeClub)}
                            <div class="ch-nm-name">${match.home}</div>
                            <div class="ch-nm-sub">Home</div>
                        </div>
                        <div class="ch-nm-vs">vs</div>
                        <div class="ch-nm-team away ${!userIsHome ? 'user' : ''}">
                            ${crest(awayClub)}
                            <div class="ch-nm-name">${match.away}</div>
                            <div class="ch-nm-sub">Away</div>
                        </div>
                    </div>
                    <div class="ch-nm-meta">
                        <div><span class="lbl">Competition</span>${competition}</div>
                        <div><span class="lbl">Venue</span>${venue}</div>
                        <div><span class="lbl">Round</span>${round} of ${this._totalRounds()}</div>
                        <div><span class="lbl">Kickoff</span>${date ? this._formatDate(date) : '—'}</div>
                    </div>
                    <div class="ch-nm-play-row">
                        <button class="ch-nm-play-btn" id="chNextMatchPlayBtn">▶ Play Match</button>
                    </div>
                `;
                const btn = document.getElementById('chNextMatchPlayBtn');
                btn?.addEventListener('click', () => this._fastForwardToMatch(next));
            }

            _currentCompetitionName() {
                const mgr = (typeof GameStorage !== 'undefined') ? GameStorage.loadManager() : null;
                const nation = (mgr?.nation && typeof SEA_NATIONS !== 'undefined')
                    ? SEA_NATIONS.find(n => n.code === mgr.nation) : null;
                return nation?.leagueName || 'League';
            }

            _totalRounds() {
                const fixtures = (typeof GameStorage !== 'undefined') ? GameStorage.loadFixtures() : null;
                return Array.isArray(fixtures) ? fixtures.length : 0;
            }

            // Fast-forward overlay: animates the in-game date from current to
            // the fixture date over ~1.2s while a gold bar fills, then jumps
            // to the formation screen. The opponent identity is stashed on
            // the simulator so _buildCpuOpponent can read it instead of
            // picking a random league club.
            _fastForwardToMatch(ctx) {
                const overlay = document.getElementById('ffOverlay');
                const dateEl  = document.getElementById('ffDate');
                const fill    = document.getElementById('ffFill');
                if (!overlay || !dateEl || !fill) {
                    // Fall back to immediate switch if overlay markup is missing
                    this._pendingFixture = ctx;
                    this.switchScreen('formationScreen');
                    return;
                }
                this._pendingFixture = ctx;

                const startISO = (typeof GameStorage !== 'undefined')
                    ? GameStorage.loadCurrentDate() : null;
                const endISO   = ctx.date;
                const start = startISO ? new Date(startISO) : new Date();
                const end   = endISO   ? new Date(endISO)   : start;
                const totalDays = Math.max(1, Math.round((end - start) / 86400000));

                overlay.classList.add('active');
                overlay.setAttribute('aria-hidden', 'false');
                fill.style.width = '0%';
                dateEl.textContent = this._formatDate(start.toISOString().slice(0, 10));

                const duration = 1200;   // ms
                const t0 = performance.now();
                const tick = (now) => {
                    const p = Math.min(1, (now - t0) / duration);
                    fill.style.width = (p * 100).toFixed(1) + '%';
                    const dayOffset = Math.round(p * totalDays);
                    const d = new Date(start);
                    d.setDate(d.getDate() + dayOffset);
                    dateEl.textContent = this._formatDate(d.toISOString().slice(0, 10));
                    if (p < 1) {
                        requestAnimationFrame(tick);
                    } else {
                        // Advance and persist the calendar to the match day,
                        // then recover everyone's condition over the days that
                        // just elapsed (user team + every league club roster).
                        if (typeof GameStorage !== 'undefined' && endISO) {
                            GameStorage.saveCurrentDate(endISO);
                        }
                        this._recoverConditionOverDays(totalDays);
                        this._refreshDateLabel();
                        overlay.classList.remove('active');
                        overlay.setAttribute('aria-hidden', 'true');
                        // Land on the Match Management screen in kickoff mode —
                        // the user reviews / tweaks XI + tactics, then clicks
                        // Kick Off to actually start the match.
                        this.isPreMatch = true;
                        this._openTacticsView('kickoff');
                    }
                };
                requestAnimationFrame(tick);
            }

            // After the user's match ends and they click Back to Clubhouse:
            //   1) mark the user's fixture as played + persist the score,
            //   2) simulate the other 4 matches in the same round,
            //   3) update league standings + persist,
            //   4) show a brief loading bar, then land on Today's Fixture view.
            _finalizeMatchDay() {
                this._showSimOverlay('Simulating other matches…', 1200, () => {
                    // (a) record the user's match result + (b) simulate the rest.
                    this._persistRoundResults();
                    // (c) reset the live match state so the player team / tactics
                    //     reload cleanly when the user next opens Tactics or Play.
                    this.reset();
                    // (d) drop into the clubhouse Today's Fixture view.
                    this._enterClubhouse();
                    this._navigateTo('📋 Today\'s Results', () => {
                        this._setClubhouseView('today-fixture');
                        this._renderTodaysFixturePanel();
                    });
                });
            }

            // Find the user's current fixture, mark it played with the final
            // score, then simulate every other unplayed match in that round
            // and apply all results to the league standings. Persists both.
            _persistRoundResults() {
                if (typeof GameStorage === 'undefined') return;
                const fixtures = GameStorage.loadFixtures();
                const league   = GameStorage.loadLeague();
                if (!Array.isArray(fixtures) || !Array.isArray(league)) return;
                const pending = this._pendingFixture;
                if (!pending) return;

                const userClubName = pending.userClub?.clubName;
                const round = fixtures.find(r => r.round === pending.round);
                if (!round) return;

                // (1) Mark the user's match
                const userMatch = round.matches.find(m =>
                    m.home === pending.match.home && m.away === pending.match.away);
                if (userMatch && !userMatch.played) {
                    // Map sim scores by user side. The user might be home or away.
                    const userIsHome = userMatch.home === userClubName;
                    userMatch.homeScore = userIsHome ? this.playerScore : this.cpuScore;
                    userMatch.awayScore = userIsHome ? this.cpuScore    : this.playerScore;
                    userMatch.played = true;
                    LeagueGenerator.applyResult(league,
                        userMatch.home, userMatch.away, userMatch.homeScore, userMatch.awayScore);
                }

                // (2) Simulate every other unplayed match in this round —
                // simulateMatch picks scorers/assisters from each club's
                // persistent roster, so the league-wide top scorer / assist
                // tables get attribution for these games too. Pass `nation` so
                // older saves without rosters get a lazy-seeded one.
                const mgr = (typeof GameStorage !== 'undefined') ? GameStorage.loadManager() : null;
                const nation = (mgr?.nation && typeof SEA_NATIONS !== 'undefined')
                    ? SEA_NATIONS.find(n => n.code === mgr.nation) : null;
                LeagueGenerator.simulateRound(round, league,
                    (m) => m === userMatch, { nation });

                // (3) Persist + remember the round just played so the Today's
                //     Fixture view can render it.
                GameStorage.saveFixtures(fixtures);
                GameStorage.saveLeague(league);
                this._lastPlayedRound = round;
                this._pendingFixture  = null;
            }

            // Reusable loading overlay (same DOM as fast-forward). Plays a
            // gold-bar fill over `durationMs`, then runs `onDone`. Used by
            // _finalizeMatchDay to mask the brief simulation work.
            _showSimOverlay(title, durationMs, onDone) {
                const overlay = document.getElementById('ffOverlay');
                const titleEl = document.getElementById('ffTitle');
                const dateEl  = document.getElementById('ffDate');
                const fill    = document.getElementById('ffFill');
                if (!overlay || !fill) { onDone?.(); return; }
                if (titleEl) titleEl.textContent = title;
                const iso = (typeof GameStorage !== 'undefined') ? GameStorage.loadCurrentDate() : null;
                if (dateEl) dateEl.textContent = iso ? this._formatDate(iso) : '';
                overlay.classList.add('active');
                overlay.setAttribute('aria-hidden', 'false');
                fill.style.width = '0%';

                const t0 = performance.now();
                const tick = (now) => {
                    const p = Math.min(1, (now - t0) / durationMs);
                    fill.style.width = (p * 100).toFixed(1) + '%';
                    if (p < 1) requestAnimationFrame(tick);
                    else {
                        overlay.classList.remove('active');
                        overlay.setAttribute('aria-hidden', 'true');
                        // Restore default title for the next fast-forward use.
                        if (titleEl) titleEl.textContent = 'Fast-forwarding';
                        onDone?.();
                    }
                };
                requestAnimationFrame(tick);
            }

            // Render the Today's Fixture view — every match in the round the
            // user just played, in display order. User's match is highlighted.
            _renderTodaysFixturePanel() {
                const body = document.getElementById('chTodayBody');
                const title = document.getElementById('chTodayTitle');
                if (!body) return;
                const round = this._lastPlayedRound;
                const league = (typeof GameStorage !== 'undefined') ? GameStorage.loadLeague() : [];
                const userClubName = (league || []).find(c => c.isUserClub)?.clubName || null;

                if (!round) {
                    body.innerHTML = `<div class="tm-hist-empty">No round played yet.</div>`;
                    if (title) title.textContent = 'Today\'s Results';
                    return;
                }
                if (title) {
                    title.textContent = `Round ${round.round} · ${round.date ? this._formatDate(round.date) : ''}`;
                }
                body.innerHTML = `<div class="ch-fix-round today">
                    ${round.matches.map(m => {
                        const isUser = userClubName &&
                            (m.home === userClubName || m.away === userClubName);
                        return `<div class="ch-fix-match ${isUser ? 'user-club' : ''} played">
                            <span class="ch-fix-home">${m.home}</span>
                            <span class="ch-fix-vs">${m.homeScore ?? 0} – ${m.awayScore ?? 0}</span>
                            <span class="ch-fix-away">${m.away}</span>
                        </div>`;
                    }).join('')}
                </div>`;
            }

            // Squad panel — full-pane player list (Starting XI, Bench, Reserves).
            // Clicking a row slides an overlayed detail panel over the list.
            _renderClubhouseSquad() {
                const listEl = document.getElementById('chSquadList');
                if (!listEl || !this.playerTeam?.players) return;
                // Start with the detail overlay hidden on every (re-)entry
                this._hideSquadDetail();

                // Group players for the list (XI / bench / reserves)
                const isOn   = id => this.playerTeam.onField?.some(p => p.id === id);
                const isBench = id => this.playerTeam.bench?.some(p => p.id === id);
                const xi      = this.playerTeam.players.filter(p => isOn(p.id));
                const bench   = this.playerTeam.players.filter(p => isBench(p.id) && !isOn(p.id));
                const others  = this.playerTeam.players.filter(p => !isOn(p.id) && !isBench(p.id));

                // Tab dispatch — default 'attributes'. Tab buttons live in the
                // ch-view-head; wired below so switching re-renders in place.
                if (!this._squadTab) this._squadTab = 'attributes';
                document.querySelectorAll('.ch-squad-tab').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.squadTab === this._squadTab);
                    // Re-bind by clone to keep listeners idempotent.
                    const fresh = btn.cloneNode(true);
                    btn.parentNode.replaceChild(fresh, btn);
                    fresh.addEventListener('click', () => {
                        this._squadTab = fresh.dataset.squadTab;
                        this._renderClubhouseSquad();
                    });
                });
                listEl.classList.toggle('squad-tab-performance', this._squadTab === 'performance');

                // CM 03/04-style attribute grid. Columns chosen to mirror the
                // canonical squad-attributes view: identity → summary → physical →
                // technical → mental → defensive → goalkeeping → fitness.
                // Each attribute cell is colour-tiered by value via `_attTone`.
                const COLS_ATTRIBUTES = [
                    // [key, label, group ('id' | 'sum' | 'phy' | 'tec' | 'men' | 'def' | 'gk' | 'fit')]
                    ['num',  '#',   'id'],
                    ['name', 'Name','id'],
                    ['pos',  'Pos', 'id'],
                    ['age',  'Age', 'id'],
                    ['ovr',  'OVR', 'sum'],
                    ['pace',     'Pac', 'phy'],
                    ['stamina',  'Stm', 'phy'],
                    ['strength', 'Str', 'phy'],
                    ['finishing','Fin', 'tec'],
                    ['passing',  'Pas', 'tec'],
                    ['dribbling','Drb', 'tec'],
                    ['crossing', 'Crs', 'tec'],
                    ['heading',  'Hed', 'tec'],
                    ['tackling', 'Tck', 'def'],
                    ['marking',  'Mrk', 'def'],
                    ['positioning','Pos','def'],
                    ['vision',     'Vis','men'],
                    ['creativity', 'Cre','men'],
                    ['offTheBall', 'OtB','men'],
                    ['composure',  'Cmp','men'],
                    ['determination','Det','men'],
                    ['anticipation', 'Ant','men'],
                    ['reflexes', 'Ref', 'gk'],
                    ['handling', 'Hnd', 'gk'],
                    ['condition',     'Cnd','fit'],
                    ['naturalFitness','NF', 'fit'],
                    ['form',          'Form','form'],   // Rolling avg of last 10 ratings
                ];

                // Performance columns — career-stat aggregates (filled by
                // _mergeMatchStatsIntoCareer at endMatch). Shared identity
                // columns first, then Apps / Min / Gls / Asst (totals) and
                // averages per match where they make more sense.
                const COLS_PERFORMANCE = [
                    ['num',  '#',    'id'],
                    ['name', 'Name', 'id'],
                    ['pos',  'Pos',  'id'],
                    ['age',  'Age',  'id'],
                    ['apps',     'App', 'count'],
                    ['minutes',  'Min', 'count'],
                    ['goals',    'Gls', 'count'],
                    ['assists',  'Ast', 'count'],
                    ['shots',    'Sht', 'count'],
                    ['shotsOnTarget','SoT','count'],
                    ['tackles',  'Tck', 'count'],
                    ['fouls',    'Fls', 'count'],
                    ['yellowCards','Y', 'card-y'],
                    ['redCards','R',   'card-r'],
                    ['shotsPerMatch','Sht/M','avg'],
                    ['tacklesPerMatch','Tck/M','avg'],
                    ['passPct',  'Pas%','passpct'],
                    ['avgRating','Avg', 'rating'],
                    ['form',     'Form','form'],
                ];

                const COLS = (this._squadTab === 'performance') ? COLS_PERFORMANCE : COLS_ATTRIBUTES;

                const attTone = (v) => {
                    if (v == null) return 'att-na';
                    if (v >= 85) return 'att-elite';
                    if (v >= 75) return 'att-good';
                    if (v >= 65) return 'att-ok';
                    if (v >= 55) return 'att-low';
                    return 'att-poor';
                };

                const headerHtml = `<div class="ch-squad-head">` +
                    COLS.map(([key, lbl, group]) => {
                        const cls = `csh-${key} csh-grp-${group}`;
                        return `<span class="${cls}">${lbl}</span>`;
                    }).join('') +
                `</div>`;

                // 1–10 rating tier → colour class for the Form / Avg cells.
                const ratingTone = (v) => {
                    if (v == null) return 'att-na';
                    if (v >= 7.5) return 'att-elite';
                    if (v >= 7.0) return 'att-good';
                    if (v >= 6.5) return 'att-ok';
                    if (v >= 6.0) return 'att-low';
                    return 'att-poor';
                };

                // Pass% colour scale (0–100 %).
                const passPctTone = (pct) => {
                    if (pct == null) return 'att-na';
                    if (pct >= 90) return 'att-elite';
                    if (pct >= 82) return 'att-good';
                    if (pct >= 72) return 'att-ok';
                    if (pct >= 60) return 'att-low';
                    return 'att-poor';
                };

                const cellHtml = (p, [key, _lbl, group]) => {
                    // Identity columns are shared by both tabs.
                    if (group === 'id') {
                        if (key === 'num')  return `<span class="csc-num">${p.number ?? '·'}</span>`;
                        if (key === 'name') {
                            const flag = p.flag ? `<span class="csc-flag">${p.flag}</span>` : '';
                            return `<span class="csc-name">${flag}${p.name}</span>`;
                        }
                        if (key === 'pos')  return `<span class="csc-pos">${this._positionDisplay(p)}</span>`;
                        if (key === 'age')  return `<span class="csc-age">${p.age ?? '·'}</span>`;
                    }

                    // ── Performance-tab cells ─────────────────────────────
                    if (group === 'count' || group === 'card-y' || group === 'card-r' || group === 'avg' || group === 'passpct' || group === 'rating') {
                        const c = p.career || {};
                        const apps = c.appearances || 0;
                        if (key === 'apps')           return `<span class="csc-att csc-count">${apps || '·'}</span>`;
                        if (key === 'minutes')        return `<span class="csc-att csc-count">${c.minutes || '·'}</span>`;
                        if (key === 'goals')          return `<span class="csc-att csc-count">${c.goals   || '·'}</span>`;
                        if (key === 'assists')        return `<span class="csc-att csc-count">${c.assists || '·'}</span>`;
                        if (key === 'shots')          return `<span class="csc-att csc-count">${c.shots   || '·'}</span>`;
                        if (key === 'shotsOnTarget')  return `<span class="csc-att csc-count">${c.shotsOnTarget || '·'}</span>`;
                        if (key === 'tackles')        return `<span class="csc-att csc-count">${c.tackles || '·'}</span>`;
                        if (key === 'fouls')          return `<span class="csc-att csc-count">${c.fouls   || '·'}</span>`;
                        if (key === 'yellowCards') {
                            const y = c.yellowCards || 0;
                            return `<span class="csc-att csc-count ${y > 0 ? 'card-y-tone' : 'att-na'}">${y || '·'}</span>`;
                        }
                        if (key === 'redCards') {
                            const r = c.redCards || 0;
                            return `<span class="csc-att csc-count ${r > 0 ? 'card-r-tone' : 'att-na'}">${r || '·'}</span>`;
                        }
                        if (key === 'shotsPerMatch') {
                            const v = apps ? (c.shots || 0) / apps : null;
                            return `<span class="csc-att csc-avg">${v != null ? v.toFixed(1) : '·'}</span>`;
                        }
                        if (key === 'tacklesPerMatch') {
                            const v = apps ? (c.tackles || 0) / apps : null;
                            return `<span class="csc-att csc-avg">${v != null ? v.toFixed(1) : '·'}</span>`;
                        }
                        if (key === 'passPct') {
                            const passes = c.passes || 0;
                            const pct = passes > 0 ? Math.round((c.passesCompleted || 0) / passes * 100) : null;
                            const display = pct == null ? '·' : `${pct}%`;
                            return `<span class="csc-att csc-passpct ${passPctTone(pct)}">${display}</span>`;
                        }
                        if (key === 'avgRating') {
                            const avg = this._averageForm(p);
                            const display = avg == null ? '·' : avg.toFixed(1);
                            return `<span class="csc-att csc-avg-rating ${ratingTone(avg)}">${display}</span>`;
                        }
                    }

                    // ── Attributes-tab cells ──────────────────────────────
                    if (key === 'ovr') {
                        const ovr = Math.round(p.overall || this.calculateOverall(p) || 60);
                        return `<span class="csc-att csc-ovr ${attTone(ovr)}">${ovr}</span>`;
                    }
                    if (group === 'form') {
                        // Show the last 5 ratings as a hyphen-joined sequence
                        // (oldest → newest, left → right) e.g. "6-7-6-8-9".
                        // Each digit is the rating rounded to nearest integer;
                        // the cell colour reflects the most recent rating, since
                        // that's what "current form" means.
                        const list = Array.isArray(p.formRatings) ? p.formRatings.slice(-5) : [];
                        if (!list.length) {
                            return `<span class="csc-att csc-form att-na" title="No matches played yet">·</span>`;
                        }
                        const display = list.map(r => Math.round(r)).join('-');
                        const latest  = list[list.length - 1];
                        const avg     = this._averageForm(p);
                        const tip     = `Last ${list.length} ratings — avg ${avg?.toFixed(1) ?? '–'}`;
                        return `<span class="csc-att csc-form ${ratingTone(latest)}" title="${tip}">${display}</span>`;
                    }
                    const v = (typeof p[key] === 'number') ? Math.round(p[key]) : null;
                    // Dim GK-only attributes for outfielders (they're irrelevant)
                    const dim = (group === 'gk' && p.position !== 'GK') ? ' csc-dim' : '';
                    const display = v == null ? '·' : v;
                    return `<span class="csc-att ${attTone(v)}${dim}">${display}</span>`;
                };

                const rowHtml = (p) => {
                    const cells = COLS.map(col => cellHtml(p, col)).join('');
                    return `<div class="ch-squad-row" data-player-id="${p.id}">${cells}</div>`;
                };

                const section = (label, group) => group.length
                    ? `<div class="ch-squad-section-head">${label} (${group.length})</div>${group.map(rowHtml).join('')}`
                    : '';

                listEl.innerHTML =
                    headerHtml +
                    section('Starting XI',  xi) +
                    section('Bench',        bench) +
                    section('Reserves',     others);

                // Persist the displayed ordering so the detail panel's Prev /
                // Next buttons walk through players in the same visual order
                // (XI first, then Bench, then Reserves).
                this._squadOrder = [...xi, ...bench, ...others].map(p => p.id);

                listEl.querySelectorAll('.ch-squad-row').forEach(row => {
                    row.addEventListener('click', () => {
                        const pid = parseInt(row.dataset.playerId, 10);
                        const p = this.playerTeam.players.find(x => x.id === pid);
                        if (!p) return;
                        this._showSquadDetail(p);
                    });
                });

                // Wire the detail-overlay controls once per render (cloneNode
                // wipes stale handlers from the previous render).
                const wireBtn = (id, fn) => {
                    const btn = document.getElementById(id);
                    if (!btn) return;
                    const fresh = btn.cloneNode(true);
                    btn.parentNode.replaceChild(fresh, btn);
                    fresh.addEventListener('click', fn);
                };
                wireBtn('chSquadCloseBtn', () => this._hideSquadDetail());
                wireBtn('chSquadPrevBtn',  () => this._stepSquadDetail(-1));
                wireBtn('chSquadNextBtn',  () => this._stepSquadDetail(+1));

                // Keyboard nav (bound once): Esc closes; ←/→ step through.
                if (!this._squadEscBound) {
                    this._squadEscBound = true;
                    document.addEventListener('keydown', (e) => {
                        const overlay = document.getElementById('chSquadDetail');
                        if (!overlay?.classList.contains('active')) return;
                        if (e.key === 'Escape')      { this._hideSquadDetail(); }
                        else if (e.key === 'ArrowLeft')  { e.preventDefault(); this._stepSquadDetail(-1); }
                        else if (e.key === 'ArrowRight') { e.preventDefault(); this._stepSquadDetail(+1); }
                    });
                }
            }

            // Show/hide the absolutely-positioned detail overlay over the squad list.
            _showSquadDetail(player) {
                if (!player) return;
                // Track where in the displayed squad order this player sits so
                // Prev / Next can step from here. _squadOrder is filled by the
                // most recent _renderClubhouseSquad().
                this._squadIdx = (this._squadOrder || []).indexOf(player.id);
                this._renderSquadDetail(player);
                this._refreshSquadNav();
                this._highlightSquadRow(player.id);
                const overlay = document.getElementById('chSquadDetail');
                if (overlay) {
                    overlay.classList.add('active');
                    overlay.setAttribute('aria-hidden', 'false');
                }
                // Swap the squad pane to detail mode — hides the table + tabs
                // so the player detail takes the whole pane instead of being
                // nested inside the grid.
                document.querySelector('.ch-view-squad')?.classList.add('is-detail');
                // Row-scroll no longer needed (the list is hidden), but keep
                // the call cheap-noop for the case where the user toggles back.
                document.querySelector(`.ch-squad-row[data-player-id="${player.id}"]`)
                    ?.scrollIntoView({ block: 'nearest' });
            }

            // Move to the previous / next player in the displayed squad order.
            // Wraps at the ends (clicking Next on the last player jumps back to
            // the top), so the overlay never gets "stuck".
            _stepSquadDetail(delta) {
                const order = this._squadOrder || [];
                if (!order.length) return;
                const len = order.length;
                const idx = (((this._squadIdx ?? 0) + delta) % len + len) % len;
                const pid = order[idx];
                const p   = this.playerTeam?.players?.find(x => x.id === pid);
                if (p) this._showSquadDetail(p);
            }

            // Update the "i / N" counter (Prev/Next are always enabled — we wrap).
            _refreshSquadNav() {
                const label = document.getElementById('chSquadNavLabel');
                const order = this._squadOrder || [];
                if (label) {
                    label.textContent = order.length
                        ? `${(this._squadIdx ?? 0) + 1} / ${order.length}`
                        : '— / —';
                }
            }

            _highlightSquadRow(playerId) {
                document.querySelectorAll('.ch-squad-row').forEach(r => {
                    r.classList.toggle('selected', parseInt(r.dataset.playerId, 10) === playerId);
                });
            }

            _hideSquadDetail() {
                const overlay = document.getElementById('chSquadDetail');
                if (overlay) {
                    overlay.classList.remove('active');
                    overlay.setAttribute('aria-hidden', 'true');
                }
                // Restore the squad list + tab switch.
                document.querySelector('.ch-view-squad')?.classList.remove('is-detail');
                // Drop the "selected" highlight on whichever row was active
                document.querySelectorAll('.ch-squad-row.selected').forEach(r => r.classList.remove('selected'));
            }

            // Renders one player's full visible profile into the overlay body.
            // Hidden attributes (influence, luck) and the duplicate aliases
            // (shooting, speed, offensive, defensive — kept for legacy code
            // paths) are intentionally omitted.
            _renderSquadDetail(player) {
                const inner = document.getElementById('chSquadDetailInner');
                if (!inner) return;
                if (!player) {
                    inner.innerHTML = '';
                    return;
                }

                const ovr = Math.round(player.overall || 60);
                const ovrCls = ovr >= 90 ? 'ovr-90' : ovr >= 80 ? 'ovr-80'
                             : ovr >= 70 ? 'ovr-70' : ovr >= 60 ? 'ovr-60'
                             : ovr >= 50 ? 'ovr-50' : 'ovr-40';
                const av = (typeof AvatarGenerator !== 'undefined' && player.avatar)
                    ? AvatarGenerator.createSVG(player.avatar, 84, this.playerTeam.jerseyColor)
                    : '';

                // Visible CM 03/04 attribute groups (everything but hidden + aliases)
                const ATTR_GROUPS = [
                    { label: 'Physical',    keys: ['pace', 'stamina', 'strength'] },
                    { label: 'Mental',      keys: ['composure', 'determination', 'anticipation',
                                                   'vision', 'creativity', 'offTheBall', 'positioning'] },
                    { label: 'Technical',   keys: ['finishing', 'passing', 'dribbling', 'crossing',
                                                   'heading', 'tackling', 'marking'] },
                    { label: 'Goalkeeping', keys: ['reflexes', 'handling'] },
                ];
                const attrLabel = k => k
                    .replace(/([A-Z])/g, ' $1')         // camelCase → spaced
                    .replace(/^./, s => s.toUpperCase());
                const attrColor = v =>
                    v >= 85 ? '#16A34A' : v >= 70 ? '#86EFAC'
                  : v >= 55 ? '#A0A0A0' : v >= 40 ? '#FACC15' : '#EF4444';
                const attrRow = k => {
                    const v = Math.round(player[k] || 0);
                    return `<div class="ch-attr-row">
                        <span>${attrLabel(k)}</span>
                        <span class="ch-attr-bar"><div style="width:${v}%;background:${attrColor(v)};"></div></span>
                        <span class="ch-attr-val">${v}</span>
                    </div>`;
                };
                const groupSection = g => `
                    <div class="ch-detail-section">
                        <div class="ch-detail-section-head">${g.label}</div>
                        <div class="ch-attr-grid">${g.keys.map(attrRow).join('')}</div>
                    </div>`;

                // Position summary — natural + secondary list
                const secondaries = (player.secondaryPositions || []).filter(Boolean);
                const positionsHtml = `
                    <div class="ch-detail-section">
                        <div class="ch-detail-section-head">Positions</div>
                        <div class="ch-pos-list">
                            <span class="ch-pos-pill ch-pos-natural">${player.naturalPosition || player.position || '?'} · Natural</span>
                            ${secondaries.map(s => `<span class="ch-pos-pill">${s} · Secondary</span>`).join('')}
                        </div>
                    </div>`;

                // Form (PES-style morale arrow + label)
                const moraleHtml = `
                    <div class="ch-detail-section">
                        <div class="ch-detail-section-head">Form</div>
                        <div class="ch-form-row">
                            ${this._moraleArrowSVG(player.morale, 22)}
                            <span style="color:${this._moraleColor(player.morale)}; font-weight: 700; letter-spacing: 0.4px;">${this._moraleLabel(player.morale)}</span>
                        </div>
                    </div>`;

                const career = `${player.appearances || 0} apps · ${player.goals || 0} g · ${player.assists || 0} a`;

                inner.innerHTML = `
                    <div class="ch-detail-head">
                        <div class="ch-detail-avatar">${av}</div>
                        <div class="ch-detail-titles">
                            <div class="ch-detail-name">${player.flag ? player.flag + ' ' : ''}${player.name}</div>
                            <div class="ch-detail-pos">${player.nationality ? player.nationality + ' · ' : ''}${this._positionDisplay(player)}
                                <span class="ch-ovr ${ovrCls}">${ovr}</span>
                            </div>
                            <div class="ch-detail-bio">Age ${player.age ?? '?'} · ${player.height ?? '?'} cm · ${this._footDisplay(player.foot)}${
                                this._isOutOfPosition(player)
                                    ? ` · <span style="color:#FF9500;">⚠ playing ${player.position}</span>`
                                    : ''
                            }</div>
                            <div class="ch-detail-bio" style="margin-top:6px;">#${player.number ?? '·'} · ${career}</div>
                        </div>
                    </div>
                    ${positionsHtml}
                    ${moraleHtml}
                    ${ATTR_GROUPS.map(groupSection).join('')}
                `;
            }

            // ─── Navigation stack (back / forward) ─────────────────────────
            // Pushes a labelled entry whose .apply() re-runs the navigation
            // (e.g. switch screen + set clubhouse view). The floating buttons
            // step through the stack without re-pushing.
            _initNavStack() {
                if (this._navStack) return;        // idempotent
                this._navStack = [];
                this._navIdx   = -1;
                const back = document.getElementById('navBackBtn');
                const fwd  = document.getElementById('navFwdBtn');
                if (back) back.addEventListener('click', () => this._navBack());
                if (fwd)  fwd .addEventListener('click', () => this._navForward());
                this._refreshNavButtons();
            }

            _navigateTo(label, applyFn) {
                if (!this._navStack) this._initNavStack();
                // Truncate any "forward" history — new branch
                if (this._navIdx < this._navStack.length - 1) {
                    this._navStack = this._navStack.slice(0, this._navIdx + 1);
                }
                // Avoid pushing exact-same consecutive entry
                const last = this._navStack[this._navIdx];
                if (!last || last.label !== label) {
                    this._navStack.push({ label, apply: applyFn });
                    this._navIdx = this._navStack.length - 1;
                }
                applyFn();
                this._refreshNavButtons();
            }

            _navBack() {
                if (!this._navStack || this._navIdx <= 0) return;
                this._navIdx--;
                try { this._navStack[this._navIdx].apply(); } catch (e) { console.warn('nav back failed', e); }
                this._refreshNavButtons();
            }

            _navForward() {
                if (!this._navStack || this._navIdx >= this._navStack.length - 1) return;
                this._navIdx++;
                try { this._navStack[this._navIdx].apply(); } catch (e) { console.warn('nav forward failed', e); }
                this._refreshNavButtons();
            }

            _refreshNavButtons() {
                const backDisabled = !this._navStack || this._navIdx <= 0;
                const fwdDisabled  = !this._navStack || this._navIdx >= this._navStack.length - 1;
                const label = this._navStack?.[this._navIdx]?.label || '—';

                // Desktop rail nav pill + mobile footer nav pill share the same
                // semantics; keep them in lockstep.
                ['navBackBtn', 'mobileNavBackBtn'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.disabled = backDisabled;
                });
                ['navFwdBtn', 'mobileNavFwdBtn'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.disabled = fwdDisabled;
                });
                ['navLabel', 'mobileNavLabel'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = label;
                });
            }

            // Renders a stylised football stadium into the #chStadium slot —
            // outer ring of stands, oval pitch, centre circle + halfway line,
            // floodlight cones, and the kit-colour seats in the lower tier.
            _renderStadiumSVG(kitColor) {
                const slot = document.getElementById('chStadium');
                if (!slot) return;
                const c = kitColor || '#FFD700';
                slot.innerHTML = `
                    <svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg">
                        <!-- Sky / stand back -->
                        <defs>
                            <linearGradient id="chSky" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0" stop-color="#0a1428"/><stop offset="1" stop-color="#1c3960"/>
                            </linearGradient>
                            <radialGradient id="chPitch" cx="0.5" cy="0.5" r="0.6">
                                <stop offset="0" stop-color="#268f26"/><stop offset="1" stop-color="#155515"/>
                            </radialGradient>
                            <radialGradient id="chLight" cx="0.5" cy="0" r="0.9">
                                <stop offset="0" stop-color="rgba(255,250,200,0.65)"/>
                                <stop offset="1" stop-color="rgba(255,250,200,0)"/>
                            </radialGradient>
                        </defs>
                        <rect width="200" height="130" fill="url(#chSky)"/>
                        <!-- Floodlights -->
                        <ellipse cx="40" cy="20" rx="40" ry="22" fill="url(#chLight)"/>
                        <ellipse cx="160" cy="20" rx="40" ry="22" fill="url(#chLight)"/>
                        <!-- Outer stadium shell (stands) -->
                        <ellipse cx="100" cy="85" rx="92" ry="40" fill="#1a1a1a" stroke="#333" stroke-width="0.8"/>
                        <!-- Upper-tier seats -->
                        <ellipse cx="100" cy="80"  rx="86" ry="34" fill="#2a2a2a"/>
                        <!-- Lower tier seats in kit colour -->
                        <ellipse cx="100" cy="84"  rx="78" ry="30" fill="${c}" opacity="0.32"/>
                        <ellipse cx="100" cy="84"  rx="78" ry="30" fill="none" stroke="${c}" stroke-width="0.6" opacity="0.7"/>
                        <!-- Pitch -->
                        <ellipse cx="100" cy="86" rx="70" ry="24" fill="url(#chPitch)"/>
                        <!-- Mowing stripes -->
                        <ellipse cx="100" cy="86" rx="60" ry="20" fill="rgba(255,255,255,0.05)"/>
                        <ellipse cx="100" cy="86" rx="40" ry="13" fill="rgba(255,255,255,0.04)"/>
                        <!-- Halfway line + centre circle + spot -->
                        <line x1="100" y1="63" x2="100" y2="109" stroke="#fff" stroke-width="0.5" opacity="0.7"/>
                        <ellipse cx="100" cy="86" rx="10" ry="4" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.7"/>
                        <circle  cx="100" cy="86" r="0.7" fill="#fff" opacity="0.85"/>
                        <!-- Goals (just hinted at) -->
                        <rect x="28" y="83" width="3" height="6" fill="#fff" opacity="0.6"/>
                        <rect x="169" y="83" width="3" height="6" fill="#fff" opacity="0.6"/>
                        <!-- Floodlight pylons -->
                        <line x1="22" y1="58" x2="22" y2="20"   stroke="#444" stroke-width="1"/>
                        <line x1="178" y1="58" x2="178" y2="20" stroke="#444" stroke-width="1"/>
                        <rect x="17" y="14" width="10" height="6" fill="#222" stroke="#555" stroke-width="0.4"/>
                        <rect x="173" y="14" width="10" height="6" fill="#222" stroke="#555" stroke-width="0.4"/>
                    </svg>
                `;
            }

            // Quick league table modal (re-uses .modal-overlay styling)
            _showLeagueModal() {
                const league = (typeof GameStorage !== 'undefined') ? GameStorage.loadLeague() : null;
                let modal = document.getElementById('leagueModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'leagueModal';
                    modal.className = 'modal-overlay';
                    document.body.appendChild(modal);
                }
                if (!league || !league.length) {
                    modal.innerHTML = `<div class="modal-card"><div class="modal-head"><span>League Table</span><button class="modal-close">×</button></div><div class="modal-body"><p style="color:#888;text-align:center;padding:24px">No league generated yet.</p></div></div>`;
                } else {
                    const ordered = (typeof LeagueGenerator !== 'undefined') ? LeagueGenerator.sortTable(league) : league;
                    modal.innerHTML = `
                        <div class="modal-card modal-card-wide">
                            <div class="modal-head">
                                <span>League Table</span>
                                <button class="modal-close" aria-label="Close">×</button>
                            </div>
                            <div class="modal-body">
                                <div class="league-preview">
                                    <div class="league-row header">
                                        <span class="lp-num">#</span><span></span><span class="lp-name">Club</span>
                                        <span class="lp-num">P</span><span class="lp-num">W</span><span class="lp-num">D</span>
                                        <span class="lp-num">L</span><span class="lp-num">GF:GA</span><span class="lp-num">Pts</span>
                                    </div>
                                    ${ordered.map((c, i) => `
                                        <div class="league-row ${c.isUserClub ? 'user-club' : ''}">
                                            <span class="lp-num">${i + 1}</span>
                                            <span class="lp-crest" style="background:${c.jerseyColor};"></span>
                                            <span class="lp-name">${c.clubName}</span>
                                            <span class="lp-num">${c.played}</span>
                                            <span class="lp-num">${c.wins}</span>
                                            <span class="lp-num">${c.draws}</span>
                                            <span class="lp-num">${c.losses}</span>
                                            <span class="lp-num">${c.goalsFor}:${c.goalsAgainst}</span>
                                            <span class="lp-num">${c.points}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>`;
                }
                modal.classList.add('active');
                modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
                modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
            }

            calculateOverall(player) {
                const w = (weights) => Math.round(Object.entries(weights).reduce((s, [k, v]) => s + (player[k] || 0) * v, 0));
                switch (player.position) {
                    case 'GK':  return w({ tackling:.35, heading:.30, stamina:.15, strength:.10, speed:.10 });
                    case 'CB':  return w({ defensive:.25, tackling:.20, heading:.20, strength:.15, stamina:.10, speed:.10 });
                    case 'LB':
                    case 'RB':  return w({ defensive:.20, speed:.20, tackling:.15, passing:.15, stamina:.15, offensive:.15 });
                    case 'LWB':
                    case 'RWB': return w({ speed:.25, stamina:.20, offensive:.20, defensive:.15, passing:.10, tackling:.10 });
                    case 'CDM': return w({ defensive:.25, tackling:.20, stamina:.20, passing:.20, strength:.15 });
                    case 'CM':  return w({ passing:.25, stamina:.20, offensive:.15, defensive:.15, tackling:.15, speed:.10 });
                    case 'CAM': return w({ offensive:.25, passing:.25, shooting:.20, speed:.15, stamina:.15 });
                    case 'LM':
                    case 'RM':  return w({ speed:.25, stamina:.20, passing:.20, offensive:.20, shooting:.15 });
                    case 'LW':
                    case 'RW':  return w({ speed:.30, offensive:.25, shooting:.20, stamina:.15, passing:.10 });
                    case 'ST':
                    case 'CF':  return w({ shooting:.30, offensive:.25, heading:.15, speed:.15, strength:.15 });
                    default: {
                        const all = ['stamina','strength','speed','shooting','passing','heading','tackling','offensive','defensive'];
                        return Math.round(all.reduce((s, k) => s + (player[k] || 0), 0) / all.length);
                    }
                }
            }

            setTactic(key, value) {
                this.tactics[key] = value;
                document.querySelectorAll(`.tactic-btn[data-tactic="${key}"]`).forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === value);
                });
                // keep legacy teamInstruction in sync with mentality
                const mentMap = { 'ultra-def': 'defensive', 'defensive': 'defensive', 'normal': 'neutral', 'attacking': 'offensive', 'gung-ho': 'offensive' };
                this.teamInstruction = mentMap[this.tactics.mentality] || 'neutral';
                if (typeof GameStorage !== 'undefined') {
                    GameStorage.saveTactics(this.tactics, this.playerFormation);
                }
            }

            // Tiered colour scale for an overall rating (0–100):
            // red → yellow → grey → light green → dark green → purple
            _overallColor(score) {
                if (score >= 90) return '#C084FC'; // purple — legendary
                if (score >= 80) return '#16A34A'; // dark green — great
                if (score >= 70) return '#86EFAC'; // light green — good
                if (score >= 60) return '#A0A0A0'; // grey — average
                if (score >= 50) return '#FACC15'; // yellow — poor
                return '#EF4444';                  // red — terrible
            }

            // Stamina bar colour scale: red → yellow → green
            _staminaColor(stamina) {
                if (stamina < 30) return '#EF4444';
                if (stamina < 60) return '#FACC15';
                return '#22C55E';
            }

            // ─── Per-player match performance stats ──────────────────────────────────
            // Tracks dribbles, passes, shots, duels won, and minutes played per player so the
            // post-match result screen can show individual performance.

            // Reset per-player stats and mark every starter as on-field from minute 0.
            // Stats live on the player object directly (see generatePlayers), so each team's
            // players have their own independent stats — no shared map / ID collisions.
            _initPlayerStats() {
                const reset = p => {
                    p.stats = p.stats || {};
                    p.stats.dribbles        = 0;
                    p.stats.passes          = 0;
                    p.stats.passesCompleted = 0;
                    p.stats.shots           = 0;
                    p.stats.shotsOnTarget   = 0;
                    p.stats.tackles         = 0;   // successful tackles (separate from generic duelsWon)
                    p.stats.fouls           = 0;
                    p.stats.yellowCards     = 0;
                    p.stats.redCards        = 0;
                    p.stats.goalsScored     = 0;   // per-match (career `goals` lives on the player too)
                    p.stats.assistsGiven    = 0;
                    p.stats.duelsWon        = 0;
                    p.stats.minutesPlayed   = 0;
                    p.stats.subbedOnMinute  = null;
                    p.stats.rating          = 0;   // 1–10, computed at endMatch
                    // Clear any leftover in-match injury flag from a previous game.
                    p.injuryUntil = null;
                };
                this.playerTeam?.players?.forEach(reset);
                this.cpuTeam?.players?.forEach(reset);
                // Starters get subbedOnMinute = 0 so finalize captures the full 90 if they stay on.
                this.playerTeam?.onField?.forEach(p => { if (p.stats) p.stats.subbedOnMinute = 0; });
                this.cpuTeam?.onField?.forEach   (p => { if (p.stats) p.stats.subbedOnMinute = 0; });
            }

            _addStat(player, key, n = 1) {
                if (!player?.stats) return;
                player.stats[key] = (player.stats[key] || 0) + n;
            }

            // CM 03/04-style between-match condition recovery. Called when the
            // calendar advances (today: in _fastForwardToMatch over the days
            // between current date and kickoff). Recovery per day scales with
            // naturalFitness:
            //
            //   perDay = 8 + naturalFitness / 3      (≈ 18–35 % per day)
            //
            // Applied to every player on every roster the user can see — their
            // own playerTeam plus every league club's persistent CPU roster —
            // capped at 100. Then persists the updated league + playerTeam so
            // the recovered values survive a reload.
            _recoverConditionOverDays(days) {
                if (!days || days < 1) return;
                const bumpRoster = (players) => {
                    if (!Array.isArray(players)) return;
                    players.forEach(p => {
                        if (typeof p.condition !== 'number') p.condition = 100;
                        const nf = p.naturalFitness || 75;
                        const perDay = 8 + nf / 3;
                        p.condition = Math.min(100, p.condition + perDay * days);
                    });
                };
                bumpRoster(this.playerTeam?.players);
                if (typeof GameStorage !== 'undefined') {
                    const league = GameStorage.loadLeague();
                    if (Array.isArray(league)) {
                        league.forEach(c => bumpRoster(c.players));
                        GameStorage.saveLeague(league);
                    }
                    if (this.playerTeam) {
                        GameStorage.savePlayerTeam(this.playerTeam.serialize());
                    }
                }
            }

            // After a match ends, fold this match's per-player stats into
            // the player's persistent career totals. Two layers:
            //   p.goals / p.assists  — legacy top-level counters (kept in sync)
            //   p.career             — full career stat object for the
            //                          Clubhouse Squad → Performance tab.
            //
            // p.stats is shared by reference across the onField shallow copy
            // (see setupSquad), so reading p.stats.* here returns the genuine
            // per-match totals for both starters and players who came on.
            _mergeMatchStatsIntoCareer(teamObj) {
                if (!teamObj?.players) return;
                teamObj.players.forEach(p => {
                    const s = p.stats || {};
                    const mins = s.minutesPlayed || 0;
                    if (!mins) return;     // didn't feature — nothing to add

                    // Legacy top-level counters
                    const g = s.goalsScored  || 0;
                    const a = s.assistsGiven || 0;
                    if (g) p.goals   = (p.goals   || 0) + g;
                    if (a) p.assists = (p.assists || 0) + a;

                    // Career-stat aggregate
                    if (!p.career) p.career = {
                        appearances: 0, minutes: 0,
                        goals: 0, assists: 0,
                        shots: 0, shotsOnTarget: 0,
                        tackles: 0, fouls: 0,
                        yellowCards: 0, redCards: 0,
                        passes: 0, passesCompleted: 0,
                        dribbles: 0, duelsWon: 0,
                    };
                    p.career.appearances     += 1;
                    p.career.minutes         += mins;
                    p.career.goals           += g;
                    p.career.assists         += a;
                    p.career.shots           += s.shots           || 0;
                    p.career.shotsOnTarget   += s.shotsOnTarget   || 0;
                    p.career.tackles         += s.tackles         || 0;
                    p.career.fouls           += s.fouls           || 0;
                    p.career.yellowCards     += s.yellowCards     || 0;
                    p.career.redCards        += s.redCards        || 0;
                    p.career.passes          += s.passes          || 0;
                    p.career.passesCompleted += s.passesCompleted || 0;
                    p.career.dribbles        += s.dribbles        || 0;
                    p.career.duelsWon        += s.duelsWon        || 0;
                });
            }

            _statSubOn(player) {
                if (!player?.stats) return;
                player.stats.subbedOnMinute = this.rules.getMatchMinute(this.timeRemaining);
            }

            // Live "minutes-on-pitch" for a player, including the in-flight
            // stretch since they last came on. stats.minutesPlayed alone only
            // increments on subbedOff — so a starter who's been on the whole
            // match would otherwise show 0 until they leave.
            _liveMinutesPlayed(player) {
                if (!player?.stats) return 0;
                const banked  = player.stats.minutesPlayed || 0;
                const onSince = player.stats.subbedOnMinute;
                if (onSince == null) return banked;
                const now = this.rules?.getMatchMinute?.(this.timeRemaining) ?? 0;
                return banked + Math.max(0, now - onSince);
            }

            _statSubOff(player) {
                if (!player?.stats) return;
                if (player.stats.subbedOnMinute != null) {
                    player.stats.minutesPlayed += this.rules.getMatchMinute(this.timeRemaining) - player.stats.subbedOnMinute;
                    player.stats.subbedOnMinute = null;
                }
            }

            // CM 03/04-style 1.0–10.0 match rating, computed from in-match
            // stats. Position-weighted (defenders rewarded for clean sheets;
            // attackers rewarded harder for goals; passing matters more for
            // mids), and shifted by team-result on full-time.
            //
            // Args:
            //   player         — must have .stats and .position / .naturalPosition
            //   teamWon        — true / false / null=draw / undefined=mid-match
            //   teamConceded   — goals conceded by the player's team (for the
            //                    clean-sheet bonus; mid-match: live count)
            _computePlayerRating(player, teamWon, teamConceded) {
                if (!player?.stats) return 0;
                const s = player.stats;
                if ((s.minutesPlayed || 0) < 5) return 0;     // didn't really feature

                const pos = player.naturalPosition || player.position;
                const isGK  = pos === 'GK';
                const isDef = !isGK && ['CB','LB','RB','LWB','RWB','CDM'].includes(pos);
                const isMid = ['CM','CAM','LM','RM','LW','RW'].includes(pos);
                const isAtk = ['ST','CF'].includes(pos);

                // Baseline — CM 03/04-style: GK/Def average a hair below mid/atk.
                // Mirrors community-observed ~6.7-6.8 average for the team.
                let r = isGK ? 6.7 : isDef ? 6.5 : isMid ? 6.6 : 6.7;

                // ── Attacking contributions, scaled by how attacking the role is ──
                const atkWeight = isGK ? 0.30 : isDef ? 0.60 : isMid ? 1.00 : 1.20;
                r += (s.goalsScored  || 0) * 1.10 * atkWeight;
                r += (s.assistsGiven || 0) * 0.55 * atkWeight;
                r += Math.min(0.50, (s.shotsOnTarget || 0) * 0.12) * atkWeight;
                r += Math.min(0.45, (s.dribbles      || 0) * 0.09);

                // ── Passing — completion above a 70 % baseline; mids care more ──
                if ((s.passes || 0) >= 4) {
                    const pct = (s.passesCompleted || 0) / s.passes;
                    const passWeight = isMid ? 1.20 : 1.00;
                    r += Math.max(-1.0, Math.min(1.0, (pct - 0.70) * 1.4)) * passWeight;
                }

                // ── Defensive contributions, scaled by how defensive the role is ──
                const defWeight = isGK ? 0.40 : isDef ? 1.30 : isMid ? 0.90 : 0.50;
                r += Math.min(0.80, (s.tackles  || 0) * 0.13) * defWeight;
                r += Math.min(0.50, (s.duelsWon || 0) * 0.07) * defWeight;

                // ── Clean-sheet bonus / leaky-defence penalty (DEF + GK) ──
                // Applied at full-time only (teamWon != null) so mid-match
                // ratings don't oscillate when the opponent scores.
                if (teamWon != null && (isDef || isGK) && typeof teamConceded === 'number') {
                    if (teamConceded === 0)      r += isGK ? 0.85 : 0.45;
                    else if (teamConceded === 1) r += isGK ? 0.10 : 0.05;
                    else if (teamConceded >= 3)  r -= isGK ? 0.70 : 0.30;
                }

                // ── Discipline ──
                r -= (s.fouls       || 0) * 0.12;
                r -= (s.yellowCards || 0) * 0.40;
                r -= (s.redCards    || 0) * 2.00;

                // ── Team-result modifier (full-time only) ──
                if (teamWon === true)       r += 0.30;
                else if (teamWon === false) r -= 0.20;

                return Math.max(3.0, Math.min(10.0, Math.round(r * 10) / 10));
            }

            // Computes rating for every player on both squads that featured
            // (minutesPlayed > 0). Called once at endMatch. Also appends each
            // user-team starter's rating to their rolling form history so the
            // Form column in the Clubhouse squad view updates.
            _computeAllRatings() {
                const ps = this.playerScore, cs = this.cpuScore;
                const playerWon = ps === cs ? null : ps > cs;
                const cpuWon    = ps === cs ? null : cs > ps;
                this.playerTeam?.players?.forEach(p => {
                    p.stats.rating = this._computePlayerRating(p, playerWon, cs);
                    this._recordFormRating(p, p.stats.rating);
                });
                this.cpuTeam?.players?.forEach(p => {
                    p.stats.rating = this._computePlayerRating(p, cpuWon, ps);
                    this._recordFormRating(p, p.stats.rating);
                });
            }

            // Append a non-zero rating to the player's rolling form history,
            // capped at the most recent 10 matches. Persists with the player.
            _recordFormRating(player, rating) {
                if (!player || !rating) return;
                if (!Array.isArray(player.formRatings)) player.formRatings = [];
                player.formRatings.push(rating);
                if (player.formRatings.length > 10) {
                    player.formRatings = player.formRatings.slice(-10);
                }
            }

            // Average of the player's last N form ratings; null when no history.
            _averageForm(player) {
                const list = Array.isArray(player?.formRatings) ? player.formRatings : null;
                if (!list || !list.length) return null;
                const sum = list.reduce((a, b) => a + b, 0);
                return Math.round((sum / list.length) * 10) / 10;
            }

            // Close out minutes for anyone still on the field — called at endMatch.
            _finalizePlayerStats() {
                const endMin = this.rules.getMatchMinute(this.timeRemaining);
                [this.playerTeam, this.cpuTeam].forEach(t => {
                    t?.onField?.forEach(p => {
                        if (p.stats && p.stats.subbedOnMinute != null) {
                            p.stats.minutesPlayed += endMin - p.stats.subbedOnMinute;
                            p.stats.subbedOnMinute = null;
                        }
                    });
                });
            }

            // CM 03/04: per-player Mentality / Tackling / Passing override the team setting.
            // 'default' on the player means "follow team". Returns the effective value.
            _playerTactic(player, key) {
                const v = player?.instructions?.[key];
                if (v && v !== 'default') return v;
                return this.tactics[key];
            }

            // Display a player's positional competence as "Natural/Sec1/Sec2".
            // E.g. ST with secondaries [CF, CAM] → "ST/CF/CAM". Falls back to plain natural
            // (or current position) when no secondaries exist.
            _positionDisplay(player) {
                const natural = player.naturalPosition || player.position;
                const secs = player.secondaryPositions || [];
                // Natural position is wrapped in .pos-primary so it stands out
                // from the secondaries. Returns HTML — callers should render
                // via template literals into innerHTML. For attribute uses
                // (e.g. title=""), use _positionDisplayPlain instead.
                const primary = `<span class="pos-primary">${natural}</span>`;
                return secs.length ? `${primary}/${secs.join('/')}` : primary;
            }

            // Plain-text version of the position list — used wherever HTML
            // markup would leak as visible text (e.g. title="" tooltips).
            _positionDisplayPlain(player) {
                const natural = player.naturalPosition || player.position;
                const secs = player.secondaryPositions || [];
                return secs.length ? `${natural}/${secs.join('/')}` : natural;
            }

            // True when a player is being asked to play a slot their natural+secondaries don't cover.
            _isOutOfPosition(player) {
                const playing = player.position;
                const natural = player.naturalPosition;
                if (!natural || playing === natural) return false;
                const secs = player.secondaryPositions || [];
                return !secs.includes(playing);
            }

            // Pretty label for a player's foot preference (used in the detail card).
            _footDisplay(foot) {
                if (foot === 'left')  return '🦶 Left foot';
                if (foot === 'both')  return '🦶 Two-footed';
                return '🦶 Right foot';     // default + 'right'
            }

            // PES condition-arrow palette (classic PES era — best → worst:
            // red ↑ → orange ↗ → yellow → → blue ↘ → purple ↓).
            _moraleColor(morale) {
                return ({
                    'top':      '#FF2D55',  // red / pink
                    'good':     '#FF9500',  // orange
                    'normal':   '#FFCC00',  // yellow
                    'poor':     '#3B82F6',  // blue
                    'terrible': '#A855F7',  // purple
                })[morale] || '#FFCC00';
            }
            _moraleGlyph(morale) {
                return ({ top:'↑', good:'↗', normal:'→', poor:'↘', terrible:'↓' })[morale] || '→';
            }
            _moraleLabel(morale) {
                return ({ top:'Top form', good:'Good', normal:'Normal', poor:'Poor', terrible:'Terrible' })[morale] || 'Normal';
            }

            // Chunky SVG arrow for the PES-style morale indicator. Far more legible than the
            // unicode glyph at small sizes — drawn as a thick filled shape with a black outline,
            // rotated per tier. Used by the bench list, formation slot, and details overlay.
            _moraleArrowSVG(morale, size = 14) {
                if (!morale) return '';
                const color = this._moraleColor(morale);
                const rot = ({ top: 0, good: 45, normal: 90, poor: 135, terrible: 180 })[morale] ?? 90;
                // 24×24 viewBox; default shape points up
                return `<svg class="morale-arrow-svg" viewBox="0 0 24 24" width="${size}" height="${size}"
                    style="transform: rotate(${rot}deg); display: inline-block; vertical-align: middle;"
                    aria-label="${this._moraleLabel(morale)}">
                    <path d="M12 2 L21 12 L15.5 12 L15.5 22 L8.5 22 L8.5 12 L3 12 Z"
                          fill="${color}" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
                </svg>`;
            }

            // Compute a goalkeeper jersey colour from the outfield kit with maximum contrast.
            //   1. Convert team RGB → HSL.
            //   2. Rotate hue 180° (complementary).
            //   3. Avoid the pitch's green band [90°,150°] by shifting +60° if needed.
            //   4. Push saturation high so the kit pops against grass.
            //   5. Invert lightness — dark team → bright GK kit, light team → dark GK kit.
            _gkJerseyColor(teamHex) {
                if (!teamHex || teamHex.charAt(0) !== '#') return '#FFD700';
                const r = parseInt(teamHex.slice(1,3),16) / 255;
                const g = parseInt(teamHex.slice(3,5),16) / 255;
                const b = parseInt(teamHex.slice(5,7),16) / 255;

                // RGB → HSL
                const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
                let h = 0, s = 0, l = (max + min) / 2;
                if (d !== 0) {
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                    if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
                    else if (max === g) h = ((b - r) / d + 2);
                    else                h = ((r - g) / d + 4);
                    h *= 60;
                }

                // Derive GK HSL
                let gkH = (h + 180) % 360;
                if (gkH >= 90 && gkH <= 150) gkH = (gkH + 60) % 360;  // dodge pitch green
                const gkS = Math.max(0.85, s);
                const gkL = l < 0.55 ? 0.72 : 0.28;

                // HSL → RGB
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1; if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = gkL < 0.5 ? gkL * (1 + gkS) : gkL + gkS - gkL * gkS;
                const p = 2 * gkL - q;
                const hh = gkH / 360;
                const rr = hue2rgb(p, q, hh + 1/3);
                const gg = hue2rgb(p, q, hh);
                const bb = hue2rgb(p, q, hh - 1/3);

                const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
                return '#' + toHex(rr) + toHex(gg) + toHex(bb);
            }

            // Resolve which jersey colour a player should wear — GKs get a contrasting kit.
            _jerseyFor(player, teamColor) {
                return player.position === 'GK' ? this._gkJerseyColor(teamColor) : teamColor;
            }

            showPlayerDetail(player, opts = {}) {
                const scope = this._mgmtScope || this._getActiveMgmtScope();
                const overlay = scope?.querySelector('.player-detail-overlay');
                const content = scope?.querySelector('.player-detail-overlay-content');
                if (!overlay || !content) return;

                const avatar   = AvatarGenerator.createSVG(player.avatar, 80, this._jerseyFor(player, this.playerTeam?.jerseyColor));
                const ovr      = this.calculateOverall(player);
                const ovrColor = this._overallColor(ovr);

                content.innerHTML = `
                    <div class="player-detail-header">
                        <div style="flex-shrink: 0; margin-right: 15px;">
                            ${avatar}
                        </div>
                        <div class="player-detail-info">
                            <div class="player-detail-name">${player.flag ? player.flag + ' ' : ''}${player.name}</div>
                            <div class="player-detail-position">${player.nationality ? player.nationality + ' · ' : ''}${this._positionDisplay(player)} <span style="font-size:1.1em;font-weight:bold;color:${ovrColor};">${ovr}</span></div>
                            <div class="player-detail-bio">Age ${player.age ?? '?'} · ${player.height ?? '?'} cm · ${this._footDisplay(player.foot)}${
                                this._isOutOfPosition(player)
                                    ? ` · <span style="color:#FF9500;">⚠ playing ${player.position}</span>`
                                    : ''
                            }</div>
                            <div class="player-detail-form">
                                Form: ${this._moraleArrowSVG(player.morale, 20)}
                                <span style="color:${this._moraleColor(player.morale)}; font-weight: 700; letter-spacing: 0.4px;">${this._moraleLabel(player.morale)}</span>
                            </div>
                            <div class="player-detail-number">#${player.number}</div>
                        </div>
                    </div>
                    <div class="radar-chart-container">
                        <svg id="radarChart" width="200" height="200" viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg"></svg>
                    </div>
                    <div class="attribute-bars" id="attributeBars"></div>
                `;

                this.createRadarChart(player);
                this.createAttributeBars(player);

                overlay.style.display = 'block';
                overlay.scrollTop = 0;

                // Wire the close button (it's static markup, but bind every open so a fresh handler is safe)
                const closeBtn = document.getElementById('playerDetailCloseX');
                if (closeBtn) {
                    closeBtn.onclick = () => { overlay.style.display = 'none'; };
                }
            }

            createRadarChart(player) {
                const svg = document.getElementById('radarChart');
                svg.innerHTML = '';

                const centerX = 125, centerY = 125;
                const radius = 85;
                const isGK = player.position === 'GK';
                const attrs = [
                    { key: 'stamina',    label: 'Stamina' },
                    { key: 'speed',      label: 'Speed' },
                    { key: 'shooting',   label: 'Shooting' },
                    { key: 'passing',    label: 'Passing' },
                    { key: 'heading',    label: isGK ? 'Reflex' : 'Heading' },
                    { key: 'offensive',  label: 'Offensive' },
                    { key: 'defensive',  label: 'Defensive' },
                    { key: 'tackling',   label: isGK ? 'Goalkeeping' : 'Tackling' },
                    { key: 'strength',   label: 'Strength' },
                ];
                const n = attrs.length;
                const values = attrs.map(a => Math.min(100, player[a.key] || 0));

                // Grid circles
                for (let i = 1; i <= 5; i++) {
                    const r = (radius / 5) * i;
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', centerX);
                    circle.setAttribute('cy', centerY);
                    circle.setAttribute('r', r);
                    circle.setAttribute('fill', 'none');
                    circle.setAttribute('stroke', '#FFD700');
                    circle.setAttribute('stroke-width', '0.5');
                    circle.setAttribute('opacity', '0.3');
                    svg.appendChild(circle);
                }

                // Axes and labels
                for (let i = 0; i < n; i++) {
                    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', centerX);
                    line.setAttribute('y1', centerY);
                    line.setAttribute('x2', x);
                    line.setAttribute('y2', y);
                    line.setAttribute('stroke', '#FFD700');
                    line.setAttribute('stroke-width', '0.5');
                    line.setAttribute('opacity', '0.3');
                    svg.appendChild(line);

                    const labelR = radius + 18;
                    const lx = centerX + Math.cos(angle) * labelR;
                    const ly = centerY + Math.sin(angle) * labelR;
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', lx);
                    text.setAttribute('y', ly);
                    text.setAttribute('dominant-baseline', 'middle');
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('fill', '#FFD700');
                    text.setAttribute('font-size', '9');
                    text.setAttribute('font-weight', 'bold');
                    text.textContent = attrs[i].label;
                    svg.appendChild(text);
                }

                // Data polygon
                let polygonPoints = '';
                for (let i = 0; i < n; i++) {
                    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const v = (values[i] / 100) * radius;
                    polygonPoints += `${centerX + Math.cos(angle) * v},${centerY + Math.sin(angle) * v} `;
                }
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', polygonPoints);
                polygon.setAttribute('fill', '#00FF00');
                polygon.setAttribute('stroke', '#00FF00');
                polygon.setAttribute('stroke-width', '2');
                polygon.setAttribute('opacity', '0.6');
                svg.appendChild(polygon);

                // Data points
                for (let i = 0; i < n; i++) {
                    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
                    const v = (values[i] / 100) * radius;
                    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    dot.setAttribute('cx', centerX + Math.cos(angle) * v);
                    dot.setAttribute('cy', centerY + Math.sin(angle) * v);
                    dot.setAttribute('r', '3');
                    dot.setAttribute('fill', '#FFD700');
                    dot.setAttribute('stroke', '#00FF00');
                    dot.setAttribute('stroke-width', '1.5');
                    svg.appendChild(dot);
                }
            }

            createAttributeBars(player) {
                const container = document.getElementById('attributeBars');
                container.innerHTML = '';

                // CM 03/04-style attributes, grouped. `influence` and `luck` are hidden and intentionally omitted.
                const groups = [
                    { title: 'Physical', attrs: [
                        { name: 'Pace',          key: 'pace' },
                        { name: 'Stamina',       key: 'stamina' },
                        { name: 'Strength',      key: 'strength' },
                    ]},
                    { title: 'Mental', attrs: [
                        { name: 'Composure',     key: 'composure' },
                        { name: 'Determination', key: 'determination' },
                        { name: 'Anticipation',  key: 'anticipation' },
                        { name: 'Vision',        key: 'vision' },
                        { name: 'Creativity',    key: 'creativity' },
                        { name: 'Off The Ball',  key: 'offTheBall' },
                        { name: 'Positioning',   key: 'positioning' },
                    ]},
                    { title: 'Technical', attrs: [
                        { name: 'Finishing',     key: 'finishing' },
                        { name: 'Passing',       key: 'passing' },
                        { name: 'Dribbling',     key: 'dribbling' },
                        { name: 'Crossing',      key: 'crossing' },
                        { name: 'Heading',       key: 'heading' },
                        { name: 'Tackling',      key: 'tackling' },
                        { name: 'Marking',       key: 'marking' },
                    ]},
                    { title: 'Goalkeeping', attrs: [
                        { name: 'Reflexes',      key: 'reflexes' },
                        { name: 'Handling',      key: 'handling' },
                    ]},
                ];

                groups.forEach(group => {
                    const header = document.createElement('div');
                    header.className = 'attribute-group-title';
                    header.style.cssText = 'grid-column: 1 / -1; color: var(--c-gold); font-weight: 700; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase; margin: 6px 0 2px; border-bottom: 1px solid var(--c-border-gold); padding-bottom: 2px;';
                    header.textContent = group.title;
                    container.appendChild(header);

                    group.attrs.forEach(attr => {
                        const raw = player[attr.key];
                        if (raw == null) return;
                        const value = Math.min(100, raw);
                        const barColor = value < 50 ? 'linear-gradient(90deg,#aa0000,#ff3333)'
                                       : value < 70 ? 'linear-gradient(90deg,#aa6600,#ffaa00)'
                                       : value < 85 ? 'linear-gradient(90deg,#aaaa00,#dddd00)'
                                       :              'linear-gradient(90deg,#00aa00,#00ff00)';
                        const div = document.createElement('div');
                        div.className = 'attribute-bar';
                        div.innerHTML = `
                            <div class="attribute-label">${attr.name}</div>
                            <div class="attribute-value">${Math.round(value)}</div>
                            <div class="attribute-bar-bg">
                                <div class="attribute-bar-fill" style="width:${value}%;background:${barColor}"></div>
                            </div>
                        `;
                        container.appendChild(div);
                    });
                });
            }

            // CM 01/02-style per-player instruction panel, rendered inside the detail overlay.
            // Update a player's instruction and propagate to the live on-field copy.
            setPlayerInstruction(player, key, value) {
                if (!player) return;
                if (!player.instructions) player.instructions = Team.defaultInstructions(player.position);
                player.instructions[key] = value;
                // Sync the on-field clone (spread copies in setupSquad/subs mean we have two refs)
                const onField = this.playerTeam?.onField?.find(p => p.id === player.id);
                if (onField && onField !== player) {
                    onField.instructions = { ...player.instructions };
                }
                const bench = this.playerTeam?.bench?.find(p => p.id === player.id);
                if (bench && bench !== player) {
                    bench.instructions = { ...player.instructions };
                }
                const roster = this.playerTeam?.players?.find(p => p.id === player.id);
                if (roster && roster !== player) {
                    roster.instructions = { ...player.instructions };
                }
            }

            selectFormation(btn) {
                try {
                    if (!btn) return;
                    const formation = btn.dataset.formation;
                    if (!formation) return;
                    if (formation === this.playerFormation) return;

                    const oldFormation = this.playerFormation;

                    document.querySelectorAll('.formation-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');

                    this.playerFormation = formation;

                    const startBtn = document.getElementById('startBtn');
                    if (startBtn) startBtn.disabled = false;

                    if (this.isPreMatch && this.playerTeam) {
                        // Pre-match: rebuild the squad's starting XI to suit the new shape.
                        this.playerTeam.setupSquad(formation);
                        this.renderManagementPanel();
                    } else if (this.playerTeam && this.isRunning) {
                        // Mid-match: keep the current XI but reassign slot roles and animate them
                        // into the new formation's home positions.
                        this._applyPlayerFormationChange(oldFormation, formation);
                    }
                    if (typeof GameStorage !== 'undefined') {
                        GameStorage.saveTactics(this.tactics, this.playerFormation);
                    }
                } catch (error) {
                    console.error('Error in selectFormation:', error);
                }
            }

            // Mid-match formation change for the player team. Mirrors changeCpuFormation:
            // reassigns slot roles, clears customPos overrides (the old drags don't make sense
            // in a new shape), refreshes MatchFlow's id→player map, recomputes home positions,
            // animates the team into the new shape, and logs a manager event.
            _applyPlayerFormationChange(oldFormation, newFormation) {
                if (this.playerTeam.onField.length !== 11) {
                    this._flashMgmtNotice(`Can't change formation — playing with ${this.playerTeam.onField.length} on the pitch.`);
                    // Revert the stored formation
                    this.playerFormation = oldFormation;
                    document.querySelectorAll('.formation-btn').forEach(b => {
                        b.classList.toggle('selected', b.dataset.formation === oldFormation);
                    });
                    return;
                }

                // Clear any per-player drag-positioning overrides — they were valid for the old shape.
                ['onField', 'bench', 'players'].forEach(k => {
                    this.playerTeam[k]?.forEach(p => { if (p.customPos) delete p.customPos; });
                });

                this.playerTeam.assignSlotPositions(newFormation);
                this._refreshMatchFlowPlayerInfo?.();

                if (this.matchFlow && this.pitchRenderer) {
                    try {
                        const formPlayer = [1, ...newFormation.split('').map(Number)];
                        const playerPositions = this.pitchRenderer.calculatePositions(formPlayer, 1);
                        playerPositions.forEach((p, i) => this.matchFlow._home.set(i, { x: p.x, y: p.y }));
                        setTimeout(() => this.matchFlow._reshape('player', 900), 100);
                    } catch (e) {
                        console.warn('Player formation reshape failed:', e);
                    }
                }

                const minute = this.rules.getMatchMinute(this.timeRemaining);
                const fmt = f => f.split('').join('-');
                this.addEvent(
                    `📋 Manager (${minute}'): ${fmt(oldFormation)} → ${fmt(newFormation)}`,
                    'card', 'player', 'medium'
                );

                this.renderManagementPanel();
                this._flashMgmtNotice(`Formation: ${fmt(oldFormation)} → ${fmt(newFormation)}`, 'ok');
            }

            startMatch() {
                try {
                    console.log('startMatch called');
                    this.isPreMatch = false;
                    this._inMatch   = true;       // gate clubhouse access until match ends
                    this.rules.reset();
                    // Wipe everything tied to the previous match so the HUD
                    // reads zero from kickoff onwards. reset() handles this
                    // when the user clicks "Back to Clubhouse", but a fresh
                    // match started from any other entry point would otherwise
                    // inherit stale score / goals / substitutions / stats.
                    this.playerScore       = 0;
                    this.cpuScore          = 0;
                    this.timeRemaining     = 60;
                    this.goals             = [];
                    this.substitutions     = [];
                    this.cardData          = { player: [], cpu: [] };
                    this.momentum          = 50;
                    this._attackPhase      = null;
                    this._attackTeam       = null;
                    this._phaseTicks       = 0;
                    this._lastAutoSubCheck = null;
                    this.stats = {
                        playerShots: 0, cpuShots: 0,
                        playerShotsOnTarget: 0, cpuShotsOnTarget: 0,
                        playerTackles: 0, cpuTackles: 0,
                        playerPasses: 0, cpuPasses: 0,
                        playerPassesCompleted: 0, cpuPassesCompleted: 0,
                        playerCorners: 0, cpuCorners: 0,
                        playerFouls: 0, cpuFouls: 0,
                        playerOffsides: 0, cpuOffsides: 0,
                        playerFreeKicks: 0, cpuFreeKicks: 0,
                        playerPossession: 50, cpuPossession: 50,
                    };
                    // Persist the player team + tactics now so any mid-match
                    // adjustments (instructions, customPos drags) survive a reload.
                    if (typeof GameStorage !== 'undefined' && this.playerTeam) {
                        GameStorage.savePlayerTeam(this.playerTeam.serialize());
                        GameStorage.saveTactics(this.tactics, this.playerFormation);
                    }
                    this.cpuFormation = this.getRandomFormation();
                    console.log('CPU formation:', this.cpuFormation);

                    console.log('Creating CPU team...');
                    // playerTeam already set up via management panel.
                    // If we have a league, draw the opponent from the table so the
                    // CPU side carries a real club identity (crest, kit, budget) and
                    // its squad is generated with the right home nation + budget.
                    this.cpuTeam = this._buildCpuOpponent();
                    console.log('CPU team created successfully');

                    console.log('Setting up CPU squad...');
                    this.cpuTeam.setupSquad(this.cpuFormation);
                    console.log('CPU squad set up successfully');

                    console.log('Updating UI...');
                    // Inject crests and club names
                    document.getElementById('playerTeamDisplay').innerHTML =
                        `${this.playerTeam.crestSVG}<div class="match-team-name">${this.playerTeam.clubName}</div>`;
                    document.getElementById('cpuTeamDisplay').innerHTML =
                        `${this.cpuTeam.crestSVG}<div class="match-team-name">${this.cpuTeam.clubName}</div>`;
                    // Match meta strip (competition · round · date · venue) +
                    // empty scorer strips ready to be filled by goal events.
                    this._renderMatchMeta();
                    this._renderScorerStrip();

                    // Show manage team button during match
                    document.getElementById('manageBtn').style.display = 'block';

                    console.log('Switching to match screen...');
                    this.switchScreen('matchScreen');

                    // Initialize pitch visualization
                    console.log('Initializing pitch visualization...');
                    this.pitchRenderer.createPitchSVG('pitchSVG');
                    console.log('Pitch SVG created');

                    this.setupPitchPlayers();
                    console.log('Pitch players set up');

                    this._initPlayerStats();   // reset per-player performance counters
                    // Push the freshly-zeroed state into the DOM right away
                    // so the first frame the user sees shows 0–0 / blank
                    // scorers / blank subs, instead of last match's leftovers.
                    this.updateUI();
                    this.isRunning = true;
                    console.log('Starting match...');
                    this.audio?.whistle(true);  // kick-off whistle
                    this.dramatic?.play('kickoff', {
                        attackTeam:  this.playerTeam?.onField || [],
                        defendTeam:  this.cpuTeam?.onField    || [],
                        attackColor: this.playerTeam?.jerseyColor,
                        defendColor: this.cpuTeam?.jerseyColor,
                        minute: 1,
                    });
                    this.runMatch();
                    console.log('Match running');
                } catch (error) {
                    console.error('Error in startMatch:', error);
                    console.error('Error stack:', error.stack);
                    alert('Error starting match: ' + error.message);
                }
            }

            // Build the id → player map MatchFlow uses to read per-player instructions.
            // Called once at match start and again after every substitution / formation change.
            _refreshMatchFlowPlayerInfo() {
                if (!this.matchFlow) return;
                const info = {};
                this.playerTeam?.onField?.forEach((p, i) => { info[i]       = p; });
                this.cpuTeam?.onField?.forEach   ((p, i) => { info[i + 100] = p; });
                this.matchFlow.setPlayerInfo(info);
            }

            setupPitchPlayers() {
                try {
                    console.log('setupPitchPlayers called');
                    const formPlayer = [1, ...this.playerFormation.split('').map(Number)];
                    const formCpu = [1, ...this.cpuFormation.split('').map(Number)];
                    console.log('Player formation:', formPlayer, 'CPU formation:', formCpu);

                    const playerPositions = this.pitchRenderer.calculatePositions(formPlayer, 1);
                    const cpuPositions = this.pitchRenderer.calculatePositions(formCpu, 2);
                    console.log('Calculated positions. Player count:', playerPositions.length, 'CPU count:', cpuPositions.length);

                    // Apply customPos overrides for any player team starter that's been dragged on
                    // the formation view. Formation-view coords are (x: 0–100, y: 0–100) with the GK
                    // at the bottom — translate to match-pitch coords where player team's GK is at x≈8.
                    this.playerTeam.onField.forEach((player, idx) => {
                        if (player.customPos && idx < playerPositions.length) {
                            playerPositions[idx] = {
                                x: 100 - player.customPos.y,
                                y: player.customPos.x,
                            };
                        }
                    });

                    console.log('Rendering player team...');
                    this.playerTeam.onField.forEach((player, idx) => {
                        if (idx < playerPositions.length) {
                            const pos = playerPositions[idx];
                            const kit = this._jerseyFor(player, this.playerTeam.jerseyColor);
                            this.pitchRenderer.renderPlayer(idx, pos.x, pos.y, player.number, kit, player.name);
                        }
                    });
                    console.log('Player team rendered');

                    console.log('Rendering CPU team...');
                    this.cpuTeam.onField.forEach((player, idx) => {
                        if (idx < cpuPositions.length) {
                            const pos = cpuPositions[idx];
                            const kit = this._jerseyFor(player, this.cpuTeam.jerseyColor);
                            this.pitchRenderer.renderPlayer(idx + 100, pos.x, pos.y, player.number, kit, player.name);
                        }
                    });
                    console.log('CPU team rendered');

                    this.pitchRenderer.renderBall(50, 50);
                    console.log('Ball rendered');

                    if (this.matchFlow) this.matchFlow.stop();
                    this.matchFlow = new MatchFlow(this.pitchRenderer, this.animationEngine);
                    this.matchFlow.init(playerPositions, cpuPositions);
                    this._refreshMatchFlowPlayerInfo();
                    this.matchFlow.start();
                    console.log('MatchFlow started');
                } catch (error) {
                    console.error('Error in setupPitchPlayers:', error);
                    console.error('Error stack:', error.stack);
                    alert('Error setting up pitch: ' + error.message);
                }
            }

            getRandomFormation() {
                const formations = ['442', '433', '451', '532', '541', '352', '343'];
                return formations[Math.floor(Math.random() * formations.length)];
            }

            // Build the CPU side for a match. Prefers a real opposing club from
            // the saved league (so we get a proper crest, kit and budget-driven
            // squad). Falls back to a neutral random team when no league exists
            // (e.g. before onboarding, or on a wiped career).
            _buildCpuOpponent() {
                const mgr     = (typeof GameStorage !== 'undefined') ? GameStorage.loadManager() : null;
                const league  = (typeof GameStorage !== 'undefined') ? GameStorage.loadLeague() : null;
                const homeCode = mgr?.nation;
                const homeNation = (homeCode && typeof SEA_NATIONS !== 'undefined')
                    ? SEA_NATIONS.find(n => n.code === homeCode) : null;

                if (Array.isArray(league) && league.length > 1) {
                    let club = null;
                    // If the user came in through "Play Next Match", honour the
                    // fixture's opponent so the right two clubs actually meet.
                    const pending = this._pendingFixture;
                    if (pending?.match && pending?.userClub) {
                        const oppName = (pending.match.home === pending.userClub.clubName)
                            ? pending.match.away : pending.match.home;
                        club = league.find(c => c.clubName === oppName) || null;
                    }
                    // Fallback: pick any non-user club (used for "Play again" /
                    // testing flows where there's no scheduled fixture).
                    if (!club) {
                        const opponents = league.filter(c => !c.isUserClub);
                        if (opponents.length) {
                            club = opponents[Math.floor(Math.random() * opponents.length)];
                        }
                    }
                    if (club) {
                        // Lazy-seed the roster for clubs that pre-date the league
                        // roster feature (older saves) so this match contributes
                        // its CPU's scorers to the league-wide leaderboard.
                        if (typeof LeagueGenerator !== 'undefined' && homeNation) {
                            LeagueGenerator.ensureRoster(club, homeNation);
                        }
                        // Pick the CPU's match-day kit: default to their home
                        // colour; switch to away if it clashes with the user
                        // team's home (same logic as a real-life referee kit check).
                        const clubHome = club.homeColor || club.jerseyColor;
                        const clubAway = club.awayColor || Team.computeAwayColor(clubHome);
                        const userHome = this.playerTeam.jerseyColor;
                        const cpuKit   = Team.colorsClash(userHome, clubHome) ? clubAway : clubHome;

                        const cpu = new Team('CPU', userHome, null, {
                            homeNation, budget: club.budget,
                            // Hand Team the persistent league roster so stats
                            // mutations during the match land on the same player
                            // objects the leaderboard reads from.
                            players: Array.isArray(club.players) ? club.players : undefined,
                        });
                        // Overwrite the auto-rolled identity with the league club's,
                        // and rebuild the crest from its seed so visuals stay stable.
                        cpu.clubName    = club.clubName;
                        cpu.homeColor   = clubHome;
                        cpu.awayColor   = clubAway;
                        cpu.jerseyColor = cpuKit;          // the kit actually worn this match
                        cpu.crestSeed   = club.crestSeed;
                        if (typeof CrestGenerator !== 'undefined') {
                            cpu.crestSVG   = CrestGenerator.generateSVG(club.crestSeed, cpuKit, 70);
                            cpu.crestSVGSm = CrestGenerator.generateSVG(club.crestSeed, cpuKit, 44);
                        }
                        return cpu;
                    }
                }

                // No league saved — degrade to the previous behaviour.
                return new Team('CPU', this.playerTeam.jerseyColor, null, { homeNation });
            }

            // ─── CPU manager AI: reactively change formation based on match state ───
            _evaluateCpuFormation() {
                if (!this.isRunning || this.isPaused || !this.cpuFormation || !this.matchFlow) return;

                const minute     = this.rules.getMatchMinute(this.timeRemaining);
                const sinceLast  = minute - this._cpuLastFormationChangeMinute;
                if (this._cpuLastFormationChangeMinute > 0 && sinceLast < 12) return; // 12-min cooldown
                if (minute < 15) return; // don't react before 15 minutes
                if (minute > 88) return; // too late to bother

                const scoreDiff = this.cpuScore - this.playerScore;   // + = CPU leading
                const minLeft   = 90 - minute;
                const pick = arr => arr[Math.floor(Math.random() * arr.length)];

                let target = null, reason = '';

                if (scoreDiff <= -2 && minLeft <= 35) {
                    target = pick(['343', '433']);             reason = 'chasing the game';
                } else if (scoreDiff === -1 && minLeft <= 25) {
                    target = pick(['433', '352', '343']);      reason = 'pushing for the equaliser';
                } else if (scoreDiff >= 2 && minLeft <= 30) {
                    target = pick(['541', '532']);             reason = 'parking the bus';
                } else if (scoreDiff === 1 && minLeft <= 18) {
                    target = pick(['451', '532']);             reason = 'protecting the lead';
                } else if (scoreDiff === 0) {
                    // Tied: react to midfield imbalance, but only after the hour mark
                    if (minute < 60) return;
                    const pZones = this.getZoneRatings(this.playerTeam, this.playerFormation);
                    const cZones = this.getZoneRatings(this.cpuTeam,    this.cpuFormation);
                    if (cZones.midfield < pZones.midfield - 8) {
                        target = pick(['451', '352']);         reason = 'losing the midfield battle';
                    } else if (cZones.attack < pZones.defense - 10) {
                        target = pick(['433', '352']);         reason = 'searching for a winner';
                    }
                }

                // Avoid switching to the current formation
                if (!target || target === this.cpuFormation) return;

                this.changeCpuFormation(target, reason);
                this._cpuLastFormationChangeMinute = minute;
            }

            changeCpuFormation(newFormation, reason = 'tactical change') {
                const oldFormation = this.cpuFormation;
                this.cpuFormation = newFormation;

                // Re-role CPU players to the new formation's slot-expected positions.
                // Any mismatch with their naturalPosition triggers the efficiency penalty.
                this.cpuTeam?.assignSlotPositions?.(newFormation);
                this._refreshMatchFlowPlayerInfo?.();

                // Recompute and animate CPU players to their new home positions.
                // Only update CPU side of matchFlow._home so player team is untouched.
                if (this.matchFlow && this.pitchRenderer) {
                    try {
                        const formCpu = [1, ...newFormation.split('').map(Number)];
                        const cpuPositions = this.pitchRenderer.calculatePositions(formCpu, 2);
                        cpuPositions.forEach((p, i) => this.matchFlow._home.set(100 + i, { x: p.x, y: p.y }));
                        setTimeout(() => this.matchFlow._reshape('cpu', 900), 100);
                    } catch (e) {
                        console.warn('CPU formation reshape failed:', e);
                    }
                }

                const minute = this.rules.getMatchMinute(this.timeRemaining);
                const fmt = f => f.split('').join('-');
                this.addEvent(
                    `📋 CPU MANAGER (${minute}'): ${fmt(oldFormation)} → ${fmt(newFormation)} (${reason})`,
                    'card', 'cpu'
                );
            }

            switchScreen(screenId) {
                document.querySelectorAll('.screen').forEach(s => {
                    s.classList.remove('active');
                    s.style.display = 'none';
                });
                const screen = document.getElementById(screenId);
                screen.classList.add('active');
                if (screenId === 'managementScreen') {
                    screen.style.display = 'flex';
                } else {
                    screen.style.display = 'block';
                }
            }

            runMatch() {
                // Recursive setTimeout so changes to matchSpeed take effect on the next tick.
                const mult = () => ({ slow: 3, normal: 2, fast: 1 }[this.matchSpeed] || 1);

                const tickEvent = () => {
                    if (!this.isRunning) return;
                    if (!this.isPaused) {
                        this.generateEvent();
                        this.updateStats();
                        this.updateUI();
                        // Auto-sub policies — stamina/performance evaluation
                        // (internally throttled to every ~5 in-game minutes).
                        this._evaluateAutoSubs();
                    }
                    setTimeout(tickEvent, 500 * mult());
                };
                const tickTimer = () => {
                    if (!this.isRunning) return;
                    if (!this.isPaused) {
                        this.timeRemaining--;
                        this.updateUI();
                        if (this.timeRemaining <= 0) {
                            this.isRunning = false;
                            this.endMatch();
                            return;
                        }
                    }
                    setTimeout(tickTimer, 1000 * mult());
                };
                setTimeout(tickEvent, 500 * mult());
                setTimeout(tickTimer, 1000 * mult());
            }

            setMatchSpeed(speed) {
                if (!['slow', 'normal', 'fast'].includes(speed)) return;
                this.matchSpeed = speed;
                document.querySelectorAll('.speed-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.speed === speed);
                });
                if (typeof GameStorage !== 'undefined') {
                    GameStorage.saveSettings({ speed });
                }
            }

            // CM 03/04-style zone ratings: weighted attribute averages per zone
            // 3-band engine ratings and the formation-bonus table now live in zone-strength.js
            // — these stay as instance methods so existing call sites work unchanged.
            getZoneRatings(teamObj, formation) {
                return ZoneStrength.bandRatings(teamObj, formation);
            }

            getFormationBonus(formation) {
                return ZoneStrength.formationBonus(formation);
            }

            // ─── Attack-zone helpers ──────────────────────────────────────────────────
            // The pitch is divided into 5 bands × 3 lanes (the debug-grid). Every event that
            // involves the ball or a player carries its zone, and the rendering layer places
            // the ball at the matching pitch coordinates.

            static BANDS = 5;
            static LANES = 3;

            // (band, lane) → pitch-percent (x, y). Optional jitter shakes the result within the cell.
            _zoneToCoords(band, lane, jitter = 0) {
                const bandSize = 100 / FootballSimulator.BANDS;
                const laneSize = 100 / FootballSimulator.LANES;
                const x = (band + 0.5) * bandSize + (Math.random() - 0.5) * jitter;
                const y = (lane + 0.5) * laneSize + (Math.random() - 0.5) * jitter;
                return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
            }

            // Current attack zone as pitch coordinates (with light jitter).
            _eventCoords(jitter = 8) {
                return this._zoneToCoords(this._attackBand, this._attackLane, jitter);
            }

            // Set the attack zone explicitly.
            _setZone(band, lane) {
                this._attackBand = Math.max(0, Math.min(FootballSimulator.BANDS - 1, band));
                this._attackLane = Math.max(0, Math.min(FootballSimulator.LANES - 1, lane));
            }

            // Move the ball "forward" by `steps` bands in the attacking team's direction.
            _advanceZone(steps = 1) {
                const dir = this._attackTeam === 'player' ? 1 : -1;
                this._setZone(this._attackBand + dir * steps, this._attackLane);
            }

            // Pick a fresh lane (with a slight centre-bias) — called when a new possession starts.
            _resetLane() {
                const r = Math.random();
                this._attackLane = r < 0.45 ? 1 : r < 0.725 ? 0 : 2;   // 45 % centre, 27.5 % wings each
            }

            // Build the payload appended to every onEvent call so matchFlow can place the ball.
            _eventPayload(extra = {}) {
                const { x, y } = this._eventCoords(extra.jitter ?? 8);
                return { x, y, band: this._attackBand, lane: this._attackLane, ...extra };
            }

            // Single relay to matchFlow.onEvent: automatically annotates the payload with the
            // current zone coords unless the caller already supplied x/y (e.g. corner, freekick,
            // throw-in have their own fixed coords).
            _emitMatchEvent(type, payload = {}) {
                if (!this.matchFlow) return;
                const hasCoords = payload.x != null && payload.y != null;
                const final = hasCoords
                    ? { ...payload, band: this._attackBand, lane: this._attackLane }
                    : { ...this._eventPayload(payload), ...payload, ...this._eventCoords(8) };
                this.matchFlow.onEvent(type, final);
            }

            generateEvent() {
                // Hold off while the kickoff is being set up — the matchFlow is animating players
                // into their halves and the ball hasn't been kicked yet.
                if (this.matchFlow?._kickoffMode) return;

                // Rare: late-game special events interrupt any phase
                if (this.timeRemaining < 35 && Math.random() < 0.03) {
                    this._attackPhase = null; this.substitutionEvent(); return;
                }
                if (this.timeRemaining < 45 && Math.random() < 0.02) {
                    this._attackPhase = null; this.injuryEvent(); return;
                }

                // Flavor events: atmosphere, weather, oddities. Don't reset attack phase.
                const fr = Math.random();
                if (fr < 0.006)       { this.streakerEvent();       return; }
                else if (fr < 0.012)  { this.pitchInvaderEvent();   return; }
                else if (fr < 0.020)  { this.floodlightEvent();     return; }
                else if (fr < 0.030)  { this.weatherEvent();        return; }
                else if (fr < 0.045)  { this.ballBoyEvent();        return; }
                else if (fr < 0.065)  { this.crowdChantEvent();     return; }
                else if (fr < 0.080)  { this.managerArguesEvent(Math.random() < 0.5 ? 'player' : 'cpu'); return; }

                if (!this._attackPhase)                    this._beginPossession();
                else if (this._attackPhase === 'buildup')  this._doBuildup();
                else if (this._attackPhase === 'progression') this._doProgression();
                else                                       this._doDanger();
            }

            // ── Midfield battle: determines who wins possession, starts an attack ────
            _beginPossession() {
                const pZones = this.getZoneRatings(this.playerTeam, this.playerFormation);
                const cZones = this.getZoneRatings(this.cpuTeam, this.cpuFormation);

                const mentalityInstr = { 'ultra-def': -16, 'defensive': -8, 'normal': 0, 'attacking': 8, 'gung-ho': 16 };
                const instrMod       = mentalityInstr[this.tactics.mentality] || 0;
                const closingMod     = { 'always': 8, 'standard': 0, 'stand-off': -5, 'own-half': 2 };
                const pressingBoost  = closingMod[this.tactics.closingDown] || 0;

                const pMid    = pZones.midfield + instrMod + pressingBoost + (this.momentum - 50) * 0.15;
                const cMid    = cZones.midfield - instrMod;
                const midTotal = pMid + cMid;
                const playerHasBall = Math.random() < (midTotal > 0 ? pMid / midTotal : 0.5);
                const possession    = playerHasBall ? 'player' : 'cpu';

                // Update possession stat
                const possBias = (pMid / (midTotal || 1)) * 40 + 30;
                this.stats.playerPossession = Math.round(this.stats.playerPossession * 0.9 + possBias * 0.1);
                this.updatePossession();

                // Card events are possession-neutral: don't reset the attack flow
                const scoreDiff = this.playerScore - this.cpuScore;
                const chaseMod  = playerHasBall ? (scoreDiff < -1 ? 0.03 : 0) : (scoreDiff > 1 ? 0.03 : 0);
                if (Math.random() < 0.04 + chaseMod) {
                    this.cardEvent(possession === 'player' ? 'cpu' : 'player');
                    return; // Phase stays null; next tick re-battles
                }

                this._attackTeam = possession;
                this._phaseTicks = 0;

                // Possession resets to the attacking team's own half. Lane is freshly chosen
                // with a centre-bias.
                this._setZone(possession === 'player' ? 1 : 3, this._attackLane);
                this._resetLane();

                // Visual: show the ball changing hands, now anchored to the new zone
                this._emitMatchEvent('possession', this._eventPayload({ team: possession, jitter: 14 }));

                // Gung-ho / direct teams launch immediately, skipping patient buildup.
                // Counter-Attack tactic adds a big +35 % chance to skip — the team wins it deep
                // and breaks fast (only applies for the player team for now; CPU baseline is no).
                const skipChance = possession === 'player'
                    ? ({ 'gung-ho': 0.40, 'attacking': 0.20, 'normal': 0, 'defensive': 0, 'ultra-def': 0 }[this.tactics.mentality] || 0)
                      + ({ 'direct': 0.20, 'mixed': 0, 'short': 0 }[this.tactics.passing] || 0)
                      + (this.tactics.counterAttack === 'yes' ? 0.35 : 0)
                    : 0;

                this._attackPhase = Math.random() < skipChance ? 'progression' : 'buildup';
                if (this._attackPhase === 'progression') this._advanceZone(1);
            }

            // ── Buildup phase: working ball out from defense / own half ───────────────
            _doBuildup() {
                const team = this._attackTeam;
                const opp  = team === 'player' ? 'cpu' : 'player';
                this._phaseTicks++;

                // High press by opponent: chance to steal the ball in deep buildup
                const defTeamObj = opp === 'player' ? this.playerTeam : this.cpuTeam;
                const defZones   = this.getZoneRatings(defTeamObj, opp === 'player' ? this.playerFormation : this.cpuFormation);
                const pressMod   = opp === 'player'
                    ? ({ 'always': 1.40, 'standard': 1.0, 'stand-off': 0.60, 'own-half': 0.75 }[this.tactics.closingDown] || 1.0)
                    : 1.0;
                // Man-marking sticks tighter to ball-carriers → modest turnover bonus.
                const markMod = opp === 'player'
                    ? (this.tactics.marking === 'man' ? 1.10 : 1.0)
                    : 1.0;
                const turnoverChance = (defZones.midfield / 100) * pressMod * markMod * 0.18;

                if (Math.random() < turnoverChance) {
                    // Sometimes a defensive header wins the duel instead of a tackle
                    if (Math.random() < 0.30) this.headerEvent(opp, false);
                    else                     this.tackleEvent(opp);
                    this._attackTeam  = opp;
                    this._attackPhase = 'buildup';
                    this._phaseTicks  = 0;
                    return;
                }

                // Ball briefly out of play — team retains via throw-in. Time-wasting tactic
                // boosts this chance when the team is in front (and never below baseline).
                const isLeading = team === 'player'
                    ? this.playerScore > this.cpuScore
                    : this.cpuScore > this.playerScore;
                const twMult = team === 'player' && isLeading
                    ? ({ never: 1.0, mixed: 1.5, often: 2.5 }[this.tactics.timeWasting] || 1.0)
                    : 1.0;
                if (Math.random() < 0.06 * twMult) {
                    this.throwInEvent(team);
                    return; // Stay in buildup, same tick count
                }

                // Buildup occasionally starts from a goal kick
                if (this._phaseTicks === 1 && Math.random() < 0.10) {
                    this.goalKickEvent(team);
                    return;
                }

                // How many buildup passes before pushing forward (tactic-driven)
                const maxBuildup = team === 'player'
                    ? ({ 'short': 3, 'mixed': 2, 'direct': 1 }[this.tactics.passing] || 2)
                    : 2;

                if (this._phaseTicks >= maxBuildup) {
                    const ok = this.passEvent(team);   // final ball over the top / into midfield
                    if (!ok) {                          // pass given away / offside
                        this._attackTeam  = opp;
                        this._attackPhase = 'buildup';
                        this._phaseTicks  = 0;
                        return;
                    }
                    this._attackPhase = 'progression';
                    this._phaseTicks  = 0;
                    this._advanceZone(1);               // shift one band forward
                } else {
                    const ok = this.passEvent(team);   // safe pass, staying in own half
                    if (!ok) {
                        this._attackTeam  = opp;
                        this._attackPhase = 'buildup';
                        this._phaseTicks  = 0;
                        return;
                    }
                    // Occasional small lane shift to keep things visually varied
                    if (Math.random() < 0.25) this._attackLane = (this._attackLane + (Math.random() < 0.5 ? -1 : 1) + 3) % 3;
                }
            }

            // ── Progression phase: pushing into the attacking third ───────────────────
            _doProgression() {
                const team = this._attackTeam;
                const opp  = team === 'player' ? 'cpu' : 'player';
                this._phaseTicks++;

                const defTeamObj = opp === 'player' ? this.playerTeam : this.cpuTeam;
                const defZones   = this.getZoneRatings(defTeamObj, opp === 'player' ? this.playerFormation : this.cpuFormation);
                const pressMod   = opp === 'player'
                    ? ({ 'always': 1.30, 'standard': 1.0, 'stand-off': 0.65, 'own-half': 0.80 }[this.tactics.closingDown] || 1.0)
                    : 1.0;
                const interceptionChance = (defZones.defense / 100) * pressMod * 0.20;

                const r = Math.random();

                if (r < interceptionChance) {
                    if (r < interceptionChance * 0.40) {
                        // Defense sprung the offside trap
                        this.offsideTrapEvent(opp);
                        this._attackTeam  = opp;
                        this._attackPhase = 'buildup';
                        this._phaseTicks  = 0;
                    } else if (r < interceptionChance * 0.75) {
                        // Defense wins ball cleanly in the final third
                        this.tackleEvent(opp);
                        this._attackTeam  = opp;
                        this._attackPhase = 'buildup';
                        this._phaseTicks  = 0;
                    } else {
                        // Defense clears — ball goes out for a corner. The attacking
                        // team takes the corner, so they retain possession; the next
                        // tick lands in the danger phase to resolve the in-box action.
                        this.cornerEvent(team);
                        this._attackPhase = 'danger';
                        this._attackTeam  = team;
                        this._phaseTicks  = 0;
                    }
                    return;
                }

                // Speculative long shot from outside the box — ends the attack.
                // Probability scales only with how many onfield mids have the individual
                // longShots instruction set to 'often' (Long Shots is per-player only in CM 03/04).
                const teamObjLS = team === 'player' ? this.playerTeam : this.cpuTeam;
                const oftenShooters = teamObjLS?.onField?.filter(p =>
                    ['CM','CAM','CDM','LM','RM'].includes(p.position) && p.instructions?.longShots === 'often'
                ).length || 0;
                const lsProb = Math.min(0.25, 0.06 + oftenShooters * 0.045);
                if (Math.random() < lsProb) {
                    this.longShotEvent(team);
                    this._attackPhase = null;
                    this._attackTeam  = null;
                    this._phaseTicks  = 0;
                    return;
                }

                // Mazy dribble past defenders — pushes attack on if successful.
                // Boosted by onfield wingers with runWithBall: often.
                const teamObjDB = team === 'player' ? this.playerTeam : this.cpuTeam;
                const oftenRunners = teamObjDB?.onField?.filter(p =>
                    ['LW','RW','CAM','ST','CF','LM','RM'].includes(p.position) && p.instructions?.runWithBall === 'often'
                ).length || 0;
                const dribProb = Math.min(0.22, 0.08 + oftenRunners * 0.025);
                if (Math.random() < dribProb) {
                    this.dribbleEvent(team);
                    return; // stay in progression
                }

                // How long to build in the final third before forcing a shot
                const menMod = team === 'player'
                    ? ({ 'gung-ho': 0, 'attacking': 0, 'normal': 1, 'defensive': 2, 'ultra-def': 2 }[this.tactics.mentality] ?? 1)
                    : 1;
                const pasMod = team === 'player'
                    ? ({ 'direct': 0, 'mixed': 0, 'short': 1 }[this.tactics.passing] ?? 0)
                    : 0;
                // CM 01/02 hold-up-ball instruction: any onfield forward set to 'yes' extends the
                // final-third buildup by +1 tick (slowing the attack to recycle/wait for support).
                const teamObjForHold = team === 'player' ? this.playerTeam : this.cpuTeam;
                const holdMod = teamObjForHold?.onField?.some(p =>
                    ['ST','CF','CAM'].includes(p.position) && p.instructions?.holdUpBall === 'yes'
                ) ? 1 : 0;
                const maxProg = menMod + pasMod + holdMod; // 0–4

                if (this._phaseTicks > maxProg) {
                    // Final ball: through-ball frequency scales with how many onfield playmakers
                    // have throughBalls: often (base 18 %, up to ~50 %).
                    const oftenPassers = teamObjForHold?.onField?.filter(p =>
                        ['CAM','CM','LW','RW'].includes(p.position) && p.instructions?.throughBalls === 'often'
                    ).length || 0;
                    const tbProb = Math.min(0.55, 0.18 + oftenPassers * 0.10);
                    // Wing crosses: when wide players are set to crossBall: often, the final ball
                    // becomes a cross into the box (resolves as an aerial chance / header).
                    const oftenCrossers = teamObjForHold?.onField?.filter(p =>
                        ['LB','RB','LWB','RWB','LM','RM','LW','RW'].includes(p.position)
                        && p.instructions?.crossBall === 'often'
                    ).length || 0;
                    const crossProb = Math.min(0.45, 0.05 + oftenCrossers * 0.10);
                    // Ball travels into the danger zone (final third)
                    this._setZone(team === 'player' ? 4 : 0, this._attackLane);
                    // Final ball: header/through-ball always commits to danger;
                    // a plain pass can be intercepted, which hands the ball over.
                    let ok = true;
                    if (Math.random() < crossProb)        this.headerEvent(team, true);
                    else if (Math.random() < tbProb)      this.throughBallEvent(team);
                    else                                  ok = this.passEvent(team);
                    if (!ok) {
                        this._attackTeam  = opp;
                        this._attackPhase = 'buildup';
                        this._phaseTicks  = 0;
                        return;
                    }
                    this._attackPhase = 'danger';
                    this._phaseTicks  = 0;
                } else {
                    const ok = this.passEvent(team);    // patient build-up in the final third
                    if (!ok) {
                        this._attackTeam  = opp;
                        this._attackPhase = 'buildup';
                        this._phaseTicks  = 0;
                        return;
                    }
                    // 25 % chance to advance one more band — keeps the attack moving forward
                    if (Math.random() < 0.25) this._advanceZone(1);
                    // Or a small lateral shift to widen / cut inside
                    else if (Math.random() < 0.30) this._attackLane = (this._attackLane + (Math.random() < 0.5 ? -1 : 1) + 3) % 3;
                }
            }

            // ── Danger phase: shot situation — always ends the attack sequence ────────
            _doDanger() {
                const team = this._attackTeam;
                const opp  = team === 'player' ? 'cpu' : 'player';

                // Lock the zone to the attacking team's final third for this whole resolution.
                // Subsequent events (goal / save / chance / etc.) inherit this zone.
                this._setZone(team === 'player' ? 4 : 0, this._attackLane);

                // Reset state first so any re-entrant call (goalEvent → missedChanceEvent) is clean
                this._attackPhase = null;
                this._attackTeam  = null;
                this._phaseTicks  = 0;

                const pZones = this.getZoneRatings(this.playerTeam, this.playerFormation);
                const cZones = this.getZoneRatings(this.cpuTeam, this.cpuFormation);

                const atkZone  = team === 'player' ? pZones.attack  : cZones.attack;
                const defZone  = team === 'player' ? cZones.defense : pZones.defense;

                const atkMult  = team === 'player'
                    ? ({ 'ultra-def': 0.78, 'defensive': 0.90, 'normal': 1.0, 'attacking': 1.12, 'gung-ho': 1.28 }[this.tactics.mentality] || 1.0)
                    : 1.0;
                const defMult  = team === 'player' ? 1.0
                    : ({ 'ultra-def': 1.28, 'defensive': 1.12, 'normal': 1.0, 'attacking': 0.90, 'gung-ho': 0.78 }[this.tactics.mentality] || 1.0);
                const passMult = team === 'player'
                    ? ({ 'direct': 1.10, 'mixed': 1.0, 'short': 0.92 }[this.tactics.passing] || 1.0)
                    : 1.0;

                const moMod    = (this.momentum - 50) * (team === 'player' ? 0.2 : -0.2);
                const effAtk   = atkZone * atkMult * passMult + moMod;
                const effDef   = defZone * defMult;
                const attackScore = effAtk / (effAtk + effDef + 0.01);

                const r2 = Math.random();

                // Sets the post-event possession so the NEXT generateEvent tick
                // continues from the correct team. Pass the team that owns the
                // ball after the event resolves; pass nothing to leave the
                // state as null/null (kick-off or midfield-battle restart).
                const restart = (nextTeam) => {
                    if (!nextTeam) return;
                    this._attackTeam  = nextTeam;
                    this._attackPhase = 'buildup';
                };

                // Rare specials — most resolve internally (penalty / free kick /
                // 1-on-1 / spectacular / own goal end the attack and the next
                // tick starts with a midfield battle or kickoff). The ones with
                // a clear post-event owner explicitly call restart().
                if (Math.random() < 0.04) { this.penaltyEvent(team);                                        return; }
                if (Math.random() < 0.05) { this.freeKickEvent(team);                                       return; }
                if (Math.random() < 0.06 && attackScore > 0.50) { this.oneOnOneEvent(team);                 return; }
                if (Math.random() < 0.05)                       { this.headerEvent(team, true);             return; }
                if (Math.random() < 0.04)                       { this.goalmouthScrambleEvent(team); restart(opp); return; }   // scramble usually cleared
                if (Math.random() < 0.015 && attackScore > 0.55) { this.spectacularEvent(team);             return; }
                if (Math.random() < 0.012)                      { this.ownGoalEvent(team);                  return; }
                if (Math.random() < 0.020)                      { this.goalDisallowedEvent(team); restart(opp); return; }     // defender's restart

                // A "save" branch is still a shot — increment BOTH shots and
                // shotsOnTarget. Inlined helper keeps the branch tables compact.
                const countSave = () => {
                    if (team === 'player') { this.stats.playerShots++; this.stats.playerShotsOnTarget++; }
                    else                   { this.stats.cpuShots++;    this.stats.cpuShotsOnTarget++;    }
                };
                if (attackScore > 0.62) {
                    if (r2 < 0.28)        this.goalEvent(team);                                  // → kickoff
                    else if (r2 < 0.55)   this.chanceEvent(team);                                // → ambiguous (midfield battle)
                    else if (r2 < 0.68) { this.missedChanceEvent(team); restart(opp); }          // defender's goal kick
                    else if (r2 < 0.78) { this.barEvent(team);          restart(opp); }          // rebound usually cleared
                    else if (r2 < 0.86) { this.cornerEvent(team);       restart(team); }         // attacker retains via corner
                    else                { countSave(); this.saveEvent(); restart(opp); }
                } else if (attackScore > 0.48) {
                    if (r2 < 0.12)        this.goalEvent(team);
                    else if (r2 < 0.32)   this.chanceEvent(team);
                    else if (r2 < 0.50) { this.missedChanceEvent(team); restart(opp); }
                    else if (r2 < 0.64) { countSave(); this.saveEvent(); restart(opp); }
                    else if (r2 < 0.76) { this.barEvent(team);          restart(opp); }
                    else if (r2 < 0.88) { this.cornerEvent(team);       restart(team); }
                    else                { this.tackleEvent(opp);        restart(opp); }          // defender wins the ball
                } else {
                    if (r2 < 0.05)        this.goalEvent(team);
                    else if (r2 < 0.16)   this.chanceEvent(team);
                    else if (r2 < 0.38) { countSave(); this.saveEvent(); restart(opp); }
                    else if (r2 < 0.58) { this.missedChanceEvent(team); restart(opp); }
                    else if (r2 < 0.72) { this.cornerEvent(team);       restart(team); }
                    else                { this.tackleEvent(opp);        restart(opp); }
                }
            }

            goalEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                if (teamObj.onField.length === 0) return;

                // Prefer attackers (ST/CF/LW/RW/CAM) as scorer, biased by their forwardRuns
                // instruction so "often" runners are more likely to be on the end of moves.
                const attackers = teamObj.onField.filter(p => ['ST','CF','LW','RW','CAM'].includes(p.position));
                const scorer = attackers.length > 0
                    ? this._pickByInstruction(attackers, 'forwardRuns')
                    : teamObj.getRandomPlayer(true);
                const assist = Math.random() > 0.35 ? teamObj.getRandomPlayer(true) : null;

                // GK opposition resistance
                const gk = defTeamObj.onField.find(p => p.position === 'GK');
                const gkSave = gk ? ((gk.reflexes || 70) * 0.4 + (gk.handling || 70) * 0.3 + (gk.positioning || 70) * 0.3) / 100 : 0.65;

                // Scorer quality: finishing × composure
                const finishRating = ((scorer.finishing || scorer.shooting || 70) + (scorer.composure || 70)) / 200;
                const luckBoost = ((scorer.luck || 50) - 50) / 200;
                const goalChance = finishRating - gkSave * 0.5 + luckBoost + 0.3;

                if (Math.random() > Math.max(0.15, Math.min(0.92, goalChance))) {
                    this.missedChanceEvent(team);
                    return;
                }

                const minute = this.rules.getMatchMinute(this.timeRemaining);
                this.goals.push({ team, scorer: scorer.name, assister: assist?.name ?? null, time: `${minute}'`, kind: 'open' });

                const scorerId = team === 'player'
                    ? this.playerTeam.onField.indexOf(scorer)
                    : this.cpuTeam.onField.indexOf(scorer) + 100;
                const teamId = team === 'player' ? 1 : 2;

                if (team === 'player') {
                    this.playerScore++;
                    this.stats.playerShots++;
                    this.stats.playerShotsOnTarget++;
                    this.momentum = Math.min(100, this.momentum + 20);
                } else {
                    this.cpuScore++;
                    this.stats.cpuShots++;
                    this.stats.cpuShotsOnTarget++;
                    this.momentum = Math.max(0, this.momentum - 15);
                }
                const assistText = assist ? ` (assist: <b class="ev-name">${assist.name}</b>)` : '';
                this._addStat(scorer, 'shots');
                this._addStat(scorer, 'shotsOnTarget');
                this._addStat(scorer, 'goalsScored');         // per-match goals
                if (scorer && typeof scorer.goals === 'number') scorer.goals++;   // career
                if (assist) {
                    this._addStat(assist, 'assistsGiven');
                    if (typeof assist.assists === 'number') assist.assists++;
                }
                this.audio?.goalRoar();
                this.dramatic?.play('goal', { name: scorer.name, minute, color: (team === 'player' ? this.playerTeam?.jerseyColor : this.cpuTeam?.jerseyColor) });
                this.addEvent(`⚽ GOAL (${minute}')! <b class="ev-name">${scorer.name}</b> scores!${assistText}`, 'goal', team);

                this._emitMatchEvent('goal', { scorer: scorerId, team });
                this.showCelebration(scorer, team);
            }

            getTeamStrength(teamObj) {
                if (!teamObj || teamObj.onField.length === 0) return 50;
                let total = 0, n = 0;
                teamObj.onField.forEach(p => {
                    if (p.position !== 'GK') {
                        const skill = ((p.finishing || p.shooting || 60) + (p.passing || 60) +
                                       (p.offTheBall || p.offensive || 60) + (p.tackling || 60)) / 4;
                        total += skill * (1 + (p.influence || 70) / 200);
                        n++;
                    }
                });
                return n > 0 ? Math.round(total / n) : 50;
            }

            chanceEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                // Prefer off-the-ball movement positions, weighted by forwardRuns instruction
                // so 'often' runners get into shooting positions more frequently.
                const movers = teamObj.onField.filter(p => ['ST','CF','CAM','LW','RW'].includes(p.position));
                const player = movers.length > 0
                    ? this._pickByInstruction(movers, 'forwardRuns')
                    : teamObj.getRandomPlayer(true);
                const otb = player.offTheBall || player.offensive || 70;
                const quality = otb > 82 ? 'Clear' : otb > 68 ? 'Good' : 'Half';
                if (team === 'player') {
                    this.stats.playerShots++;
                    this.momentum = Math.min(100, this.momentum + 5);
                } else {
                    this.stats.cpuShots++;
                    this.momentum = Math.max(0, this.momentum - 4);
                }
                this._addStat(player, 'shots');
                this.audio?.crowdCheer();
                this.addEvent(`🎯 ${quality} chance for <b class="ev-name">${player.name}</b>!`, 'chance', team);
                this._emitMatchEvent('chance', { team });
            }

            tackleEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const attTeam = team === 'player' ? 'cpu' : 'player';
                // Prefer CDM/CB/LB/RB as tacklers
                const tacklers = teamObj.onField.filter(p => ['CDM','CB','LB','RB','LWB','RWB'].includes(p.position));
                const defender = tacklers.length > 0 ? tacklers[Math.floor(Math.random() * tacklers.length)] : teamObj.getRandomPlayer(true);

                // Tackle success: tackling + anticipation vs stamina
                const staminaFactor = (defender.stamina || 70) / 100;
                const det = (defender.determination || 70) / 100;
                const tacklePower = ((defender.tackling || 65) * 0.55 + (defender.anticipation || 65) * 0.45) / 100;
                const tackleSuccess = tacklePower * (staminaFactor + (1 - staminaFactor) * det * 0.5) * 0.9 + 0.15;

                // Tackling style: defender's individual setting overrides team via _playerTactic.
                // hard = more success but more fouls; easy = fewer fouls, fewer wins.
                const tacklingStyle = this._playerTactic(defender, 'tackling') || 'normal';
                const tackleBoost  = tacklingStyle === 'hard' ? 0.08 : tacklingStyle === 'easy' ? -0.08 : 0;
                // Tight-marking tacklers stick closer and read the ball-carrier — modest extra boost
                const tightBoost   = defender.instructions?.tightMarking === 'yes' ? 0.06 : 0;
                const adjustedSuccess = Math.min(0.92, tackleSuccess + tackleBoost + tightBoost);
                const foulRate     = tacklingStyle === 'hard' ? 0.55 : tacklingStyle === 'easy' ? 0.20 : 0.40;

                if (Math.random() > adjustedSuccess) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    // player tackling style sets foul rate; CPU always uses base 40%
                    const effectiveFoulRate = team === 'player' ? foulRate : 0.40;
                    if (Math.random() < effectiveFoulRate) {
                        this.audio?.foul();
                        this._addStat(defender, 'fouls');
                        if (team === 'player') this.stats.playerFouls++;
                        else                   this.stats.cpuFouls++;
                        this.addEvent(`🟡 Foul by <b class="ev-name">${defender.name}</b> (${minute}')! Free kick awarded.`, 'tackle', team, 'medium');

                        // A foul in the attacker's attacking third is a "dangerous" free kick —
                        // run the full simulator-side resolution (taker stands over it, goal /
                        // wall / save / over). freeKickEvent will also trigger the visual.
                        // Otherwise it's a routine restart — just animate the visual and let
                        // possession naturally flow to the attacker.
                        const inAttackingThird = attTeam === 'player'
                            ? this._attackBand >= 3
                            : this._attackBand <= 1;
                        if (inAttackingThird) {
                            this.freeKickEvent(attTeam);
                        } else {
                            const foulX = attTeam === 'player'
                                ? 30 + Math.random() * 30   // own half / midfield band
                                : 40 + Math.random() * 30;
                            const foulY = 25 + Math.random() * 50;
                            this._emitMatchEvent('freekick', { team: attTeam, x: foulX, y: foulY });
                        }

                        if (Math.random() < 0.20) this.cardEvent(team); // possible booking
                    } else {
                        this.addEvent(`🛡️ <b class="ev-name">${defender.name}</b> misses the tackle!`, 'tackle', team);
                    }
                    return;
                }

                this._addStat(defender, 'duelsWon');
                this._addStat(defender, 'tackles');   // per-player tackle counter for rating
                if (team === 'player') {
                    this.stats.playerTackles++;
                    this.momentum = Math.min(100, this.momentum + 3);
                    this.addEvent(`🛡️ <b class="ev-name">${defender.name}</b> wins the ball!`, 'tackle', team);
                } else {
                    this.stats.cpuTackles++;
                    this.momentum = Math.max(0, this.momentum - 3);
                    this.addEvent(`🛡️ <b class="ev-name">${defender.name}</b> dispossesses the attacker!`, 'tackle', team);
                }
                this._emitMatchEvent('tackle', { team });

                // Tackle costs condition (determination softens it). Drains the
                // rolling `condition` field — the static `stamina` rating stays.
                const detMod = (defender.determination || 70) / 100;
                if (typeof defender.condition !== 'number') defender.condition = 100;
                defender.condition = Math.max(0, defender.condition - (3 * (1 - detMod * 0.4)));
            }

            passEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const passer = teamObj.getRandomPlayer(true);
                const receiver = teamObj.getRandomPlayer(true);

                // Pass quality from vision/creativity/passing, modulated by
                // current condition — a tired passer mishits more, even if
                // their underlying stamina rating is high.
                const passSkill = ((passer.passing || 70) * 0.45 + (passer.vision || 60) * 0.30 + (passer.creativity || 60) * 0.25) / 100;
                const conditionFactor = (passer.condition ?? 100) / 100;
                let passAccuracy = passSkill * (conditionFactor * 0.3 + 0.7);

                // Passing style — passer's individual setting overrides team via _playerTactic.
                // short = safer; direct = riskier but enables through-balls.
                const passerStyle = team === 'player'
                    ? (this._playerTactic(passer, 'passing') || 'mixed')
                    : 'mixed';
                if (passerStyle === 'short')  passAccuracy = Math.min(0.96, passAccuracy * 1.06);
                if (passerStyle === 'direct') passAccuracy *= 0.92;

                if (Math.random() > Math.min(0.96, passAccuracy)) {
                    const lostDesc = passerStyle === 'direct'
                        ? `⚪ <b class="ev-name">${passer.name}</b>'s direct pass is intercepted!`
                        : `⚪ <b class="ev-name">${passer.name}</b> gives the ball away!`;
                    this.addEvent(lostDesc, 'pass', team);
                    // Count the attempt even though it failed — pass-completion %
                    // wouldn't make sense otherwise.
                    this._addStat(passer, 'passes');
                    if (team === 'player') this.stats.playerPasses++;
                    else                   this.stats.cpuPasses++;
                    return false;     // turnover → caller must hand possession to opp
                }

                const passerId = teamObj.onField.indexOf(passer);
                const receiverId = teamObj.onField.indexOf(receiver);
                const baseId = team === 'player' ? 0 : 100;
                const recvPitchId = baseId + receiverId;

                // Offside check: forward pass to an attacker who is beyond the last defender.
                // Only fires 25% of the time — reflects that linesmen don't catch everything.
                const isAttacker = ['ST','CF','LW','RW','CAM'].includes(receiver.position);
                if (isAttacker && this.matchFlow && Math.random() < 0.25) {
                    if (this.matchFlow.checkPassOffside(team, recvPitchId)) {
                        const minute = this.rules.getMatchMinute(this.timeRemaining);
                        this.addEvent(
                            `🚩 OFFSIDE (${minute}') — <b class="ev-name">${receiver.name}</b> is flagged!`,
                            'tackle', team === 'player' ? 'cpu' : 'player'
                        );
                        this._emitMatchEvent('offside', { team }); // team = the offside attacker's team
                        if (team === 'player') this.stats.playerOffsides++;
                        else                   this.stats.cpuOffsides++;
                        this.momentum = team === 'player'
                            ? Math.max(0,   this.momentum - 4)
                            : Math.min(100, this.momentum + 4);
                        return false;     // free kick to the defending team
                    }
                }

                // Describe pass quality — passerStyle already resolved with per-player override
                const vision = passer.vision || 60;
                const styleLabel = passerStyle === 'direct' ? 'direct ball'
                                 : passerStyle === 'short'  ? 'short pass'
                                 : (vision > 80 ? 'incisive ball' : vision > 65 ? 'good pass' : 'short pass');
                const passDesc = styleLabel;

                this._addStat(passer, 'passes');
                this._addStat(passer, 'passesCompleted');
                if (team === 'player') {
                    this.stats.playerPasses++;
                    this.stats.playerPassesCompleted++;
                    this.addEvent(`⚪ <b class="ev-name">${passer.name}</b> — ${passDesc} to <b class="ev-name">${receiver.name}</b>`, 'pass', team);
                    this._emitMatchEvent('pass', { passer: passerId, receiver: receiverId, team });
                } else {
                    this.stats.cpuPasses++;
                    this.stats.cpuPassesCompleted++;
                    this.addEvent(`⚪ <b class="ev-name">${passer.name}</b> threads a ${passDesc} to <b class="ev-name">${receiver.name}</b>`, 'pass', team);
                    this._emitMatchEvent('pass', { passer: passerId + baseId, receiver: receiverId + baseId, team });
                }
                this.updatePossession();
                return true;     // pass completed — caller can continue the attack
            }

            saveEvent() {
                // Saving team is the one being attacked
                const team = this.momentum > 55 ? 'cpu' : this.momentum < 45 ? 'player' : (Math.random() > 0.5 ? 'player' : 'cpu');
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const keeper = teamObj.onField.find(p => p.position === 'GK');

                this.audio?.save();
                if (keeper) {
                    const reflexes = keeper.reflexes || 75;
                    const quality = reflexes > 85 ? 'world-class save' : reflexes > 72 ? 'excellent save' : 'decent stop';
                    this.addEvent(`🧤 <b class="ev-name">${keeper.name}</b> — ${quality}!`, 'save', team);
                    // Good saves boost morale a little
                    if (team === 'player') this.momentum = Math.min(100, this.momentum + 4);
                    else this.momentum = Math.max(0, this.momentum - 4);
                } else {
                    this.addEvent(`🧤 Great save!`, 'save', team);
                }
                this._emitMatchEvent('save', { team });
            }

            substitutionEvent() {
                // Auto-sub only ever applies to the CPU team — the user manages their own
                // subs via the Management Panel.
                const team = 'cpu';
                if (!this.rules.canSubstitute(team)) return;
                const teamObj = this.cpuTeam;
                const sub = teamObj.makeSubstitution();

                if (sub) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    this.rules.recordSub(team);
                    this.substitutions.push({ team, playerOut: sub.playerOut.name, playerIn: sub.playerIn.name, time: `${minute}'` });
                    this.addEvent(
                        `🔄 Sub (${minute}'): <b class="ev-name">${sub.playerOut.name}</b> off, <b class="ev-name">${sub.playerIn.name}</b> on!`,
                        'tackle', team, 'medium'
                    );
                    // Track minutes played for both sides of the swap (CPU subs too).
                    this._statSubOff(sub.playerOut);
                    this._statSubOn(sub.playerIn);
                    this._renderSubsStrip?.();   // instant chip update
                }
            }

            possessionChange() {
                const change = Math.random() > 0.5 ? 5 : -5;
                this.stats.playerPossession = Math.max(30, Math.min(70, this.stats.playerPossession + change));
                this.updatePossession();
                const team = change > 0 ? 'player' : 'cpu';
                this._emitMatchEvent('possession', { team });
            }

            missedChanceEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const attackers = teamObj.onField.filter(p => ['ST','CF','LW','RW','CAM'].includes(p.position));
                const player = attackers.length > 0 ? attackers[Math.floor(Math.random() * attackers.length)] : teamObj.getRandomPlayer(true);

                // Low composure = more miss descriptions
                const composure = player.composure || 70;
                let missDesc;
                if (composure < 60)       missDesc = 'loses composure and blazes over!';
                else if (composure < 73)  missDesc = 'misses a great opportunity!';
                else                      missDesc = 'can\'t find the finish!';

                if (team === 'player') {
                    this.stats.playerShots++;
                    this.momentum = Math.max(0, this.momentum - 3);
                } else {
                    this.stats.cpuShots++;
                    this.momentum = Math.min(100, this.momentum + 2);
                }
                this.audio?.crowdGroan();
                this.addEvent(`❌ <b class="ev-name">${player.name}</b> ${missDesc}`, 'chance', team);
                this._emitMatchEvent('miss', { team });
            }

            barEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const player = teamObj.getRandomPlayer(true);

                this.audio?.woodwork();
                if (team === 'player') {
                    this.stats.playerShots++;
                    this.addEvent(`🔴 <b class="ev-name">${player.name}</b> hits the crossbar!`, 'save', team);
                } else {
                    this.stats.cpuShots++;
                    this.addEvent(`🔴 <b class="ev-name">${player.name}</b> strikes the bar!`, 'save', team);
                }
                this._emitMatchEvent('bar', { team });
            }

            cornerEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                const player = teamObj.getRandomPlayer(true);
                if (team === 'player') this.stats.playerCorners++;
                else                   this.stats.cpuCorners++;
                this.audio?.kick();
                this.addEvent(`🚩 Corner kick! <b class="ev-name">${player.name}</b> delivers into the box`, 'pass', team, 'medium');
                this._emitMatchEvent('corner', { team });
                this.dramatic?.play('corner', {
                    takerColor:     teamObj.jerseyColor,
                    defenderColor:  defTeamObj.jerseyColor,
                    attackTeam:     teamObj.onField    || [],
                    defendTeam:     defTeamObj.onField || [],
                });
            }

            throwInEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const player = teamObj.getRandomPlayer(true);
                // Pick a realistic throw-in location along the touchline
                const sideY  = Math.random() > 0.5 ? 2 : 98;
                const throwX = 18 + Math.random() * 64;
                this.addEvent(`🤾 Throw-in by <b class="ev-name">${player.name}</b>`, 'pass', team, 'medium');
                this._emitMatchEvent('throwin', { team, sideY, throwX });
            }

            cardEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                if (teamObj.onField.length === 0) return;

                const player = teamObj.getRandomPlayer(true);
                if (this.rules.isSentOff(player)) return;

                const requestedType = Math.random() < 0.15 ? 'red' : 'yellow';
                const result = this.rules.issueCard(player, requestedType);
                if (!result) return;

                if (!this.cardData) this.cardData = { player: [], cpu: [] };
                const minute = this.rules.getMatchMinute(this.timeRemaining);
                const teamLabel = team === 'player' ? 'Your team' : 'CPU';

                if (result.cardType === 'yellow') {
                    const count = this.rules.yellowCount(player);
                    this.cardData[team].push({ player: player.name, type: 'yellow', time: minute });
                    this._addStat(player, 'yellowCards');
                    this.audio?.yellowCard();
                    this.addEvent(
                        `🟡 YELLOW CARD (${minute}') — <b class="ev-name">${player.name}</b> is booked!` +
                        (count === 1 ? ' One more and they walk.' : ''),
                        'card', team
                    );
                } else if (result.cardType === 'second_yellow') {
                    this.cardData[team].push({ player: player.name, type: 'yellow', time: minute });
                    this.cardData[team].push({ player: player.name, type: 'red',    time: minute });
                    this._addStat(player, 'yellowCards');
                    this._addStat(player, 'redCards');
                    this.audio?.redCard();
                    this.dramatic?.play('redCard', { name: player.name, minute, kind: 'second' });
                    this.addEvent(
                        `🟡🔴 SECOND YELLOW (${minute}') — <b class="ev-name">${player.name}</b> is sent off!`,
                        'card', team, 'critical'
                    );
                    this.rules.removeFromField(teamObj, player);
                    if (player.position === 'GK') {
                        this.rules.handleGKSendOff(teamObj, team, this.addEvent.bind(this));
                    } else {
                        this.addEvent(`🚨 ${teamLabel} reduced to ${teamObj.onField.length} players!`, 'card', team);
                    }
                } else {
                    // Direct red card
                    this.cardData[team].push({ player: player.name, type: 'red', time: minute });
                    this._addStat(player, 'redCards');
                    this.audio?.redCard();
                    this.dramatic?.play('redCard', { name: player.name, minute, kind: 'red' });
                    this.addEvent(
                        `🔴 RED CARD (${minute}') — <b class="ev-name">${player.name}</b> is sent off!`,
                        'card', team, 'critical'
                    );
                    this.rules.removeFromField(teamObj, player);
                    if (player.position === 'GK') {
                        this.rules.handleGKSendOff(teamObj, team, this.addEvent.bind(this));
                    } else {
                        this.addEvent(`🚨 ${teamLabel} reduced to ${teamObj.onField.length} players!`, 'card', team);
                    }
                }
            }

            injuryEvent() {
                const team = Math.random() > 0.5 ? 'player' : 'cpu';
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                if (teamObj.onField.length === 0) return;
                const injuredPlayer = teamObj.getRandomPlayer(true);
                const minute = this.rules.getMatchMinute(this.timeRemaining);

                const severity = Math.random();
                if (severity < 0.6) {
                    // Light knock — player stays on. Flag with `injuryUntil`
                    // so the on-pitch injury cross stays visible for ~3 minutes.
                    injuredPlayer.injuryUntil = minute + 3;
                    this.addEvent(`⚠️ <b class="ev-name">${injuredPlayer.name}</b> receives treatment on the touchline`, 'injury', team);
                    return;
                }

                // Respect the user's auto-sub policy for the player team. When
                // 'off', a stretcher-worthy injury still gets the description
                // but the player keeps playing (the manager will sub them
                // manually if they want to).
                const playerAutoSubOff = team === 'player'
                    && (this.tactics?.autoSubs?.onInjury || 'on') === 'off';
                if (playerAutoSubOff) {
                    this.addEvent(`⚠️ <b class="ev-name">${injuredPlayer.name}</b> takes a knock but plays on (auto-sub disabled).`, 'injury', team);
                    return;
                }
                const canSub = teamObj.bench.length > 0 && this.rules.canSubstitute(team);
                if (canSub) {
                    // Prefer same-type replacement (GK for GK, outfield for outfield)
                    const isGK = injuredPlayer.position === 'GK';
                    const replacement = isGK
                        ? (teamObj.bench.find(p => p.position === 'GK') || teamObj.bench[0])
                        : (teamObj.bench.find(p => p.position !== 'GK') || teamObj.bench[0]);

                    const outIndex = teamObj.onField.findIndex(p => p.id === injuredPlayer.id);
                    teamObj.onField[outIndex] = { ...replacement, isOnField: true };
                    teamObj.bench = teamObj.bench.filter(p => p.id !== replacement.id);
                    // Injured player goes to bench reverted to natural position label
                    injuredPlayer.position = injuredPlayer.naturalPosition || injuredPlayer.position;
                    teamObj.bench.push(injuredPlayer);
                    // Replacement assumes the slot's expected position (efficiency penalty if mismatched)
                    teamObj.assignSlotPositions(team === 'player' ? this.playerFormation : this.cpuFormation);
                    // Track minutes played
                    this._statSubOff(injuredPlayer);
                    this._statSubOn(replacement);
                    this.rules.recordSub(team);
                    this.substitutions.push({ team, playerOut: injuredPlayer.name, playerIn: replacement.name, time: `${minute}'` });
                    this.dramatic?.play('injury', { name: injuredPlayer.name, minute });
                    this._renderSubsStrip?.();   // instant chip update
                    this.addEvent(
                        `🚑 <b class="ev-name">${injuredPlayer.name}</b> stretchered off (${minute}')! <b class="ev-name">${replacement.name}</b> comes on`,
                        'injury', team, 'critical'
                    );
                } else if (teamObj.bench.length === 0) {
                    this.addEvent(`🚑 <b class="ev-name">${injuredPlayer.name}</b> is seriously injured — no substitutes left! Playing on reduced.`, 'injury', team);
                    this.rules.removeFromField(teamObj, injuredPlayer);
                } else {
                    // Bench exists but sub quota exhausted — player must play through
                    this.addEvent(`🚑 <b class="ev-name">${injuredPlayer.name}</b> is injured but all ${this.rules.MAX_SUBS} substitutions are used. Playing on.`, 'injury', team);
                }
            }

            // ─── CM 01/02-style additional events ─────────────────────────────────────

            penaltyEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                if (teamObj.onField.length === 0) return;

                const minute = this.rules.getMatchMinute(this.timeRemaining);
                const fouler = defTeamObj.getRandomPlayer(true);
                this.audio?.whistle(true);
                this.audio?.crowdCheer();
                this.dramatic?.play('penalty', {
                    name: fouler.name,
                    minute,
                    kickerColor: teamObj.jerseyColor,
                    defColor:    defTeamObj.jerseyColor,
                    gkColor:     this._gkJerseyColor(defTeamObj.jerseyColor),
                    attackTeam:  teamObj.onField    || [],
                    defendTeam:  defTeamObj.onField || [],
                });
                this.addEvent(`⚖️ PENALTY (${minute}')! <b class="ev-name">${fouler.name}</b> brings down the attacker in the box!`, 'card', team);

                // Penalty taker: prefer composed forward
                const candidates = teamObj.onField.filter(p => ['ST','CF','CAM','LW','RW'].includes(p.position));
                const taker = (candidates.length ? candidates : teamObj.onField)
                    .slice().sort((a,b) => (b.composure||60) - (a.composure||60))[0] || teamObj.getRandomPlayer(true);

                const gk = defTeamObj.onField.find(p => p.position === 'GK');
                const finish = ((taker.finishing || 70) * 0.5 + (taker.composure || 70) * 0.5) / 100;
                const save   = gk ? ((gk.reflexes || 70) * 0.5 + (gk.anticipation || 70) * 0.5) / 100 : 0.55;
                const goalP  = Math.max(0.45, Math.min(0.88, 0.72 + (finish - save) * 0.4));
                const r = Math.random();

                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
                this._addStat(taker, 'shots');

                if (r < goalP) {
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 18); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 14); }
                    this.goals.push({ team, scorer: taker.name, assister: null, time: `${minute}'`, kind: 'pen' });
                    this.audio?.goalRoar();
                    this.addEvent(`⚽ GOAL — <b class="ev-name">${taker.name}</b> coolly slots home the penalty!`, 'goal', team);
                    this._emitMatchEvent('goal', { team });
                    this.showCelebration(taker, team);
                } else if (r < goalP + (1 - goalP) * 0.55 && gk) {
                    this.addEvent(`🧤 SAVED! <b class="ev-name">${gk.name}</b> dives to push the penalty away!`, 'save', team === 'player' ? 'cpu' : 'player');
                    this._emitMatchEvent('save', { team: team === 'player' ? 'cpu' : 'player' });
                } else {
                    this.addEvent(`❌ <b class="ev-name">${taker.name}</b> blazes the penalty over the bar!`, 'chance', team);
                }
            }

            freeKickEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                if (teamObj.onField.length === 0) return;
                if (team === 'player') this.stats.playerFreeKicks++;
                else                   this.stats.cpuFreeKicks++;

                // Specialist: highest finishing + crossing among onfield
                const taker = teamObj.onField.slice().sort((a,b) =>
                    ((b.finishing||0) + (b.crossing||0)) - ((a.finishing||0) + (a.crossing||0))
                )[0] || teamObj.getRandomPlayer(true);

                const gk = defTeamObj.onField.find(p => p.position === 'GK');
                this.addEvent(`📐 Dangerous free kick — <b class="ev-name">${taker.name}</b> stands over it...`, 'pass', team, 'medium');
                // Trigger the visual setup (wall + taker + runners) on the pitch.
                this._emitMatchEvent('freekick', { team });
                // Dramatic SVG scene — taker over the ball, wall + GK ahead.
                this.dramatic?.play('freekick', {
                    takerColor: teamObj.jerseyColor,
                    wallColor: defTeamObj.jerseyColor,
                    gkColor: this._gkJerseyColor(defTeamObj.jerseyColor),
                    attackTeam: teamObj.onField    || [],
                    defendTeam: defTeamObj.onField || [],
                    taker,                                // pass the chosen specialist so the scene can stand them on the correct side of the ball
                });

                const skill = ((taker.finishing || 60) + (taker.crossing || 60)) / 2 / 100;
                const r = Math.random();
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
                this._addStat(taker, 'shots');

                if (r < skill * 0.18) {
                    // Direct free kick goal
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 16); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 12); }
                    this.goals.push({ team, scorer: taker.name, assister: null, time: `${minute}'`, kind: 'fk' });
                    this.audio?.goalRoar();
                    this.addEvent(`⚽ GOAL — <b class="ev-name">${taker.name}</b> curls a stunning free kick into the top corner!`, 'goal', team);
                    this._emitMatchEvent('goal', { team });
                    this.showCelebration(taker, team);
                } else if (r < 0.32) {
                    this.addEvent(`🧱 The wall blocks <b class="ev-name">${taker.name}</b>'s effort!`, 'save', team);
                } else if (r < 0.55) {
                    this.addEvent(`🧤 <b class="ev-name">${gk?.name || 'The keeper'}</b> tips it over for a corner!`, 'save', team === 'player' ? 'cpu' : 'player');
                    this.cornerEvent(team);
                } else {
                    this.addEvent(`❌ <b class="ev-name">${taker.name}</b> launches the free kick high over the bar`, 'chance', team);
                }
            }

            // Weighted pick: choose by instruction weight. `often`→3, `mixed`→1, `rarely`→filtered out upstream.
            _pickByInstruction(pool, instKey) {
                if (!pool.length) return null;
                const weights = pool.map(p => ({ often: 3, mixed: 1, rarely: 0.15, yes: 3, no: 1 }[p.instructions?.[instKey]] ?? 1));
                const total = weights.reduce((s, w) => s + w, 0);
                if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
                let r = Math.random() * total;
                for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
                return pool[pool.length - 1];
            }

            longShotEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                // Midfielders take long shots more often. Player instruction (longShots: often/mixed/rarely)
                // weights selection; 'rarely' players opt out unless no one else is eligible.
                const mids = teamObj.onField.filter(p => ['CM','CAM','CDM','LM','RM'].includes(p.position));
                const eligible = mids.filter(p => p.instructions?.longShots !== 'rarely');
                const pool = eligible.length ? eligible : mids;
                const shooter = pool.length
                    ? this._pickByInstruction(pool, 'longShots')
                    : teamObj.getRandomPlayer(true);
                const gk = defTeamObj.onField.find(p => p.position === 'GK');

                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
                this._addStat(shooter, 'shots');

                const skill = ((shooter.finishing || 55) + (shooter.composure || 60)) / 200;
                const r = Math.random();
                if (r < skill * 0.22) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 14); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 10); }
                    this.goals.push({ team, scorer: shooter.name, assister: null, time: `${minute}'`, kind: 'long' });
                    this.audio?.goalRoar();
                    this.addEvent(`⚽ SCREAMER! <b class="ev-name">${shooter.name}</b> lets fly from 25 yards — top bins!`, 'goal', team);
                    this._emitMatchEvent('goal', { team });
                    this.showCelebration(shooter, team);
                } else if (r < 0.55) {
                    this.addEvent(`🧤 <b class="ev-name">${shooter.name}</b>'s long-range effort is gathered by <b class="ev-name">${gk?.name || 'the keeper'}</b>`, 'save', team === 'player' ? 'cpu' : 'player');
                } else if (r < 0.75) {
                    this.addEvent(`❌ <b class="ev-name">${shooter.name}</b> drags the long shot wide`, 'chance', team);
                } else {
                    this.addEvent(`💨 <b class="ev-name">${shooter.name}</b> tries his luck from distance — sails over the crossbar`, 'chance', team);
                }
            }

            headerEvent(team, attacking = true) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                if (teamObj.onField.length === 0) return;
                if (attacking) {
                    const tall = teamObj.onField.filter(p => ['ST','CF','CB','CAM'].includes(p.position));
                    const headerer = tall.length ? tall[Math.floor(Math.random() * tall.length)] : teamObj.getRandomPlayer(true);
                    this._addStat(headerer, 'shots');
                    const r = Math.random();
                    const head = (headerer.heading || 60) / 100;
                    if (r < head * 0.25) {
                        // Headed goal — goalEvent owns the team shot counter.
                        this.goalEvent(team);
                    } else if (r < 0.55) {
                        // Saved by the keeper — counts as a shot on target.
                        if (team === 'player') { this.stats.playerShots++; this.stats.playerShotsOnTarget++; }
                        else                   { this.stats.cpuShots++;    this.stats.cpuShotsOnTarget++;    }
                        this.addEvent(`🧤 <b class="ev-name">${headerer.name}</b>'s header is well saved!`, 'save', team === 'player' ? 'cpu' : 'player');
                    } else {
                        // Over the bar — shot, but off target.
                        if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
                        this.addEvent(`💢 <b class="ev-name">${headerer.name}</b> rises but heads it over!`, 'chance', team);
                    }
                } else {
                    const cbs = teamObj.onField.filter(p => ['CB','CDM'].includes(p.position));
                    const clearer = cbs.length ? cbs[Math.floor(Math.random() * cbs.length)] : teamObj.getRandomPlayer(true);
                    this._addStat(clearer, 'duelsWon');
                    this.addEvent(`🛡️ <b class="ev-name">${clearer.name}</b> wins the aerial duel and clears!`, 'tackle', team);
                }
            }

            throughBallEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                // Players told to play through balls 'often' are heavily preferred as the passer.
                const playmakers = teamObj.onField.filter(p => ['CAM','CM','LW','RW'].includes(p.position));
                const eligible = playmakers.filter(p => p.instructions?.throughBalls !== 'rarely');
                const passerPool = eligible.length ? eligible : playmakers;
                const passer = passerPool.length
                    ? this._pickByInstruction(passerPool, 'throughBalls')
                    : teamObj.getRandomPlayer(true);
                const runners  = teamObj.onField.filter(p => ['ST','CF','LW','RW'].includes(p.position) && p.id !== passer.id);
                const receiver = runners.length ? runners[Math.floor(Math.random() * runners.length)] : teamObj.getRandomPlayer(true);
                this.addEvent(`✨ <b class="ev-name">${passer.name}</b> slides a perfect through ball to <b class="ev-name">${receiver.name}</b>!`, 'pass', team);
                this._emitMatchEvent('pass', { team });
            }

            dribbleEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                // Wingers/forwards run with the ball; instruction (runWithBall) biases who attempts it.
                const wingers = teamObj.onField.filter(p => ['LW','RW','CAM','ST','CF','LM','RM'].includes(p.position));
                const eligible = wingers.filter(p => p.instructions?.runWithBall !== 'rarely');
                const pool = eligible.length ? eligible : wingers;
                const dribbler = pool.length
                    ? this._pickByInstruction(pool, 'runWithBall')
                    : teamObj.getRandomPlayer(true);
                const drib = (dribbler.dribbling || 60) / 100;
                if (Math.random() < drib * 0.7) {
                    this._addStat(dribbler, 'dribbles');
                    this.addEvent(`🏃 <b class="ev-name">${dribbler.name}</b> dances past two defenders!`, 'pass', team);
                } else {
                    this.addEvent(`🛡️ <b class="ev-name">${dribbler.name}</b> tries to take on the defence but loses it`, 'tackle', team === 'player' ? 'cpu' : 'player');
                }
            }

            oneOnOneEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                const fwds = teamObj.onField.filter(p => ['ST','CF','LW','RW','CAM'].includes(p.position));
                const striker = fwds.length ? fwds[Math.floor(Math.random() * fwds.length)] : teamObj.getRandomPlayer(true);
                const gk = defTeamObj.onField.find(p => p.position === 'GK');

                this.audio?.crowdCheer();
                this.addEvent(`🎯 <b class="ev-name">${striker.name}</b> is clean through, one-on-one with the keeper!`, 'chance', team);
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
                this._addStat(striker, 'shots');

                const composure = (striker.composure || 70) / 100;
                const gkRating  = gk ? ((gk.reflexes || 70) + (gk.positioning || 70)) / 200 : 0.6;
                const goalP = Math.max(0.3, Math.min(0.78, 0.55 + (composure - gkRating) * 0.6));

                if (Math.random() < goalP) {
                    this.goalEvent(team);
                } else {
                    this.addEvent(`🧤 <b class="ev-name">${gk?.name || 'The keeper'}</b> stands tall and smothers it!`, 'save', team === 'player' ? 'cpu' : 'player');
                }
            }

            ownGoalEvent(team) {
                // `team` benefits; the own goal is scored by a defender on the opposing team
                const benefits = team;
                const losing = team === 'player' ? this.cpuTeam : this.playerTeam;
                const defs = losing.onField.filter(p => ['CB','LB','RB','LWB','RWB'].includes(p.position));
                const culprit = defs.length ? defs[Math.floor(Math.random() * defs.length)] : losing.getRandomPlayer(true);
                if (!culprit) return;

                const minute = this.rules.getMatchMinute(this.timeRemaining);
                if (benefits === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 14); }
                else                       { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 14); }
                // Scorer recorded without the "(OG)" inline marker — the
                // renderer adds it from `kind: 'og'` for a cleaner chip layout.
                this.goals.push({ team: benefits, scorer: culprit.name, assister: null, time: `${minute}'`, kind: 'og' });
                this.audio?.goalRoar();
                this.addEvent(`😱 OWN GOAL (${minute}')! <b class="ev-name">${culprit.name}</b> turns the ball into his own net!`, 'goal', benefits);
                this._emitMatchEvent('goal', { team: benefits });
            }

            goalDisallowedEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const scorer = teamObj.getRandomPlayer(true);
                const reason = Math.random() < 0.6 ? 'offside' : 'foul in the build-up';
                this.audio?.whistle(true);
                this.audio?.crowdGroan();
                // Dramatic 'disallowed' scene intentionally disabled — the event
                // log + audio cues are enough; the full-screen wash interrupts flow.
                this.addEvent(`🚫 GOAL DISALLOWED — <b class="ev-name">${scorer.name}</b>'s effort ruled out for ${reason}!`, 'card', team, 'critical');
                this._emitMatchEvent('offside', { team });
            }

            spectacularEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                const fwds = teamObj.onField.filter(p => ['ST','CF','CAM','LW','RW'].includes(p.position));
                const acrobat = fwds.length ? fwds[Math.floor(Math.random() * fwds.length)] : teamObj.getRandomPlayer(true);
                const gk = defTeamObj.onField.find(p => p.position === 'GK');

                const moves = ['acrobatic volley', 'bicycle kick', 'overhead kick', 'diving header'];
                const move  = moves[Math.floor(Math.random() * moves.length)];
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
                this._addStat(acrobat, 'shots');

                const skill = ((acrobat.finishing || 65) + (acrobat.composure || 65) + (acrobat.luck || 50)) / 300;
                if (Math.random() < skill * 0.35) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 22); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 16); }
                    this.goals.push({ team, scorer: acrobat.name, assister: null, time: `${minute}'`, kind: 'spec' });
                    this.audio?.goalRoar();
                    this.addEvent(`🤸 WONDER GOAL — <b class="ev-name">${acrobat.name}</b> with an outrageous ${move}!`, 'goal', team);
                    this._emitMatchEvent('goal', { team });
                    this.showCelebration(acrobat, team);
                } else {
                    this.addEvent(`🤸 <b class="ev-name">${acrobat.name}</b> attempts an audacious ${move} — ${gk?.name || 'the keeper'} watches it sail wide!`, 'chance', team);
                }
            }

            goalKickEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const gk = teamObj.onField.find(p => p.position === 'GK');
                if (!gk) return;
                this.addEvent(`🥅 Goal kick — <b class="ev-name">${gk.name}</b> launches it long`, 'pass', team);
            }

            offsideTrapEvent(team) {
                // `team` is the defending team that sprung the trap
                const attTeam = team === 'player' ? 'cpu' : 'player';
                const attObj  = attTeam === 'player' ? this.playerTeam : this.cpuTeam;
                const fwds    = attObj.onField.filter(p => ['ST','CF','LW','RW'].includes(p.position));
                const caught  = fwds.length ? fwds[Math.floor(Math.random() * fwds.length)] : attObj.getRandomPlayer(true);
                this.audio?.foul();
                this.addEvent(`🚩 Offside! <b class="ev-name">${caught.name}</b> is caught the wrong side of the last defender`, 'pass', attTeam, 'medium');
                this._emitMatchEvent('offside', { team: attTeam });
            }

            goalmouthScrambleEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const p1 = teamObj.getRandomPlayer(true);
                this.addEvent(`💥 Goalmouth scramble! <b class="ev-name">${p1?.name || 'A player'}</b> goes close as bodies fly in the six-yard box!`, 'chance', team);
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
            }

            // ─── Flavor events (no possession change, atmosphere) ────────────────────

            streakerEvent() {
                this.addEvent(`🩲 A streaker has invaded the pitch! Stewards give chase as the players look on bemused...`, 'card', null, 'flavor');
            }
            pitchInvaderEvent() {
                this.addEvent(`👤 An over-excited supporter rushes onto the pitch! Play is briefly halted.`, 'card', null, 'flavor');
            }
            crowdChantEvent() {
                const chants = [
                    'The home end is in full voice!',
                    'The away fans are belting out their anthem.',
                    '"Olé! Olé! Olé!" rings around the stadium.',
                    'The crowd whistles every touch from the visitors.',
                ];
                this.addEvent(`📣 ${chants[Math.floor(Math.random() * chants.length)]}`, 'pass', null, 'flavor');
            }
            weatherEvent() {
                const w = ['☔ Rain begins to lash down — the pitch is getting slick.',
                           '🌫️ A thick fog rolls in across the stadium.',
                           '🌬️ A swirling wind is making life hard for the goalkeepers.',
                           '❄️ Light snow flurries are blowing across the pitch.'];
                this.addEvent(w[Math.floor(Math.random() * w.length)], 'pass', null, 'flavor');
            }
            floodlightEvent() {
                this.addEvent(`💡 One of the floodlights flickers — brief delay as the officials check it.`, 'card', null, 'flavor');
            }
            managerArguesEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                this.addEvent(`📋 The ${teamObj?.clubName || 'manager'} boss is raging at the fourth official on the touchline!`, 'card', team, 'flavor');
            }
            ballBoyEvent() {
                this.addEvent(`👦 A ball boy holds onto the ball just a touch too long — words exchanged!`, 'pass', null, 'flavor');
            }

            updatePossession() {
                this.stats.cpuPossession = 100 - this.stats.playerPossession;
            }

            updateStats() {
                this.updatePossession();

                // CM 03/04-style fatigue: the static `stamina` rating drives
                // how fast the rolling `condition` drops; high `determination`
                // mildly slows that further; GKs barely tire.
                //
                //   drain/tick = baseRate × (1 - stam/100 × 0.6) × (1 - det/100 × 0.15)
                //
                // Calibrated against a 60-real-second / 90-game-minute match:
                //   stam 90, det 80 → ~30 condition drop over 90'  (100 → 70)
                //   stam 70, det 70 → ~40 condition drop over 90'  (100 → 60)
                //   stam 50, det 60 → ~50 condition drop over 90'  (100 → 50)
                // So a low-stam player passes the Low threshold (<60) in the
                // second half, while elite-stam players stay above it.
                const drainPlayer = (p) => {
                    if (typeof p.condition !== 'number') p.condition = 100;
                    const stam = (p.stamina || 75) / 100;
                    const det  = (p.determination || 70) / 100;
                    const baseRate = p.position === 'GK' ? 0.20 : 0.65;
                    const drain = baseRate * (1 - stam * 0.6) * (1 - det * 0.15);
                    p.condition = Math.max(0, p.condition - drain);
                };

                if (this.playerTeam) this.playerTeam.onField.forEach(drainPlayer);
                if (this.cpuTeam) this.cpuTeam.onField.forEach(drainPlayer);

                // Live-refresh the per-player condition bars on the match pitch.
                // (The renderer's `updateStamina` API name is historical.)
                if (this.pitchRenderer) {
                    this.playerTeam?.onField?.forEach((p, i) => this.pitchRenderer.updateStamina(i,       p.condition ?? 100));
                    this.cpuTeam?.onField?.forEach   ((p, i) => this.pitchRenderer.updateStamina(100 + i, p.condition ?? 100));
                }

                // CM 03/04-style on-pitch status icons — rating bubble, card,
                // injury cross. Computed less often than stamina (every 5 ticks
                // ≈ every 2.5s real-time / ~7.5 in-game minutes at Fast) to
                // keep the per-tick cost down.
                this._statusTickCount = (this._statusTickCount || 0) + 1;
                if (this._statusTickCount % 5 === 0 && this.pitchRenderer) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    const refresh = (p, slotId, conceded) => {
                        // Rating — only meaningful after a few minutes on the pitch.
                        // teamWon=undefined (mid-match) so the result modifier
                        // and clean-sheet bonus don't apply yet — only stats.
                        // Use live minutes-played (including the current spell)
                        // so starters get rated, not just subbed-off players.
                        const liveMins = this._liveMinutesPlayed(p);
                        let rating = 0;
                        if (liveMins >= 5) {
                            const banked = p.stats.minutesPlayed;
                            p.stats.minutesPlayed = liveMins;
                            rating = this._computePlayerRating(p, undefined, conceded);
                            p.stats.minutesPlayed = banked;
                        }
                        this.pitchRenderer.updateRating(slotId, rating);
                        // Card icon — red overrides yellow.
                        const cardKind = (p.stats?.redCards    || 0) > 0 ? 'red'
                                       : (p.stats?.yellowCards || 0) > 0 ? 'yellow'
                                       : null;
                        this.pitchRenderer.updateCardIcon(slotId, cardKind);
                        // Injury cross — shown while p.injuryUntil > current minute.
                        const injured = p.injuryUntil != null && minute < p.injuryUntil;
                        this.pitchRenderer.updateInjuryIcon(slotId, injured);
                    };
                    // Player team's "conceded" = CPU's score so far, and vice versa.
                    this.playerTeam?.onField?.forEach((p, i) => refresh(p, i,       this.cpuScore));
                    this.cpuTeam?.onField?.forEach   ((p, i) => refresh(p, 100 + i, this.playerScore));
                }

                // Momentum drifts slowly back to 50 (regression)
                this.momentum += (50 - this.momentum) * 0.02;

                // CPU manager reviews tactics periodically (sampled to avoid every-tick cost)
                if (Math.random() < 0.15) this._evaluateCpuFormation();

                // Keep the debug overlay numbers fresh
                if (this.debugMode) this._updateDebugOverlay();
            }

            updateUI() {
                document.getElementById('playerScore').textContent = this.playerScore;
                document.getElementById('cpuScore').textContent = this.cpuScore;

                document.getElementById('timer').textContent =
                    `${this.rules.getMatchMinute(this.timeRemaining)}'`;

                document.getElementById('playerShots').textContent = this.stats.playerShots;
                document.getElementById('cpuShots').textContent = this.stats.cpuShots;
                document.getElementById('playerTackles').textContent = this.stats.playerTackles;
                document.getElementById('cpuTackles').textContent = this.stats.cpuTackles;
                document.getElementById('playerPasses').textContent = this.stats.playerPasses;
                document.getElementById('cpuPasses').textContent = this.stats.cpuPasses;
                document.getElementById('playerPoss').textContent = Math.round(this.stats.playerPossession);
                document.getElementById('cpuPoss').textContent = Math.round(this.stats.cpuPossession);

                // Top stats strip tiles + scorers + subs tickers
                this._renderTopStatsStrip();
                this._renderScorerStrip();
                this._renderSubsStrip();

                // Keep the Match Management score chip in sync while the match
                // is running. Cheap no-op when the management screen isn't open.
                this._renderMatchMgmtScoreChip();
            }

            // Compact context strip above the score: Competition · Round · Date · Venue.
            // Pulled from _pendingFixture (set at fast-forward) — empty when
            // playing a friendly with no fixture context.
            _renderMatchMeta() {
                const el = document.getElementById('matchMeta');
                if (!el) return;
                const ctx = this._pendingFixture;
                const parts = [];
                const comp = (typeof this._currentCompetitionName === 'function')
                    ? this._currentCompetitionName() : null;
                if (comp) parts.push(`<span class="mm-comp">${comp}</span>`);
                if (ctx?.round) parts.push(`<span class="mm-round">Round ${ctx.round}</span>`);
                if (ctx?.date)  parts.push(`<span class="mm-date">${this._formatDate(ctx.date)}</span>`);
                if (ctx?.match && ctx?.userClub) {
                    const userIsHome = ctx.match.home === ctx.userClub.clubName;
                    const home = ctx.match.home;
                    parts.push(`<span class="mm-venue">${home} Stadium · ${userIsHome ? 'Home' : 'Away'}</span>`);
                }
                el.innerHTML = parts.join('<span class="mm-sep">·</span>');
            }

            // Top stats strip — pure stat readouts; renders even before any
            // events fire (zeros).
            _renderTopStatsStrip() {
                const s = this.stats || {};
                const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
                set('mssShotsP',  s.playerShots ?? 0);
                set('mssShotsC',  s.cpuShots    ?? 0);
                set('mssSotP',    s.playerShotsOnTarget ?? 0);
                set('mssSotC',    s.cpuShotsOnTarget    ?? 0);
                set('mssCornP',   s.playerCorners ?? 0);
                set('mssCornC',   s.cpuCorners    ?? 0);
                set('mssFoulsP',  s.playerFouls   ?? 0);
                set('mssFoulsC',  s.cpuFouls      ?? 0);

                // Cards — count from the cardData log (yellow / red per team).
                const yc = (team) => (this.cardData?.[team] || []).filter(c => c.type === 'yellow').length;
                const rc = (team) => (this.cardData?.[team] || []).filter(c => c.type === 'red').length;
                set('mssYelP', yc('player')); set('mssYelC', yc('cpu'));
                set('mssRedP', rc('player')); set('mssRedC', rc('cpu'));

                set('mssPossP', Math.round(s.playerPossession ?? 50));
                set('mssPossC', Math.round(s.cpuPossession    ?? 50));
            }

            // Scorers ticker (under the score). Livescore-style chip:
            //
            //   ⚽ Smith 45' (pen)
            //      Asst Jones
            //
            // Markers per goal `kind`:
            //   pen  → "(pen)"
            //   fk   → "(fk)"          (direct free kick)
            //   og   → "(og)"          (own goal — credited to the opposing team)
            //   long → "(long)"        (worldie from distance)
            //   spec → "(spec)"        (acrobatic / bicycle / overhead)
            // Open-play goals get no marker.
            _renderScorerStrip() {
                const KIND_LABEL = {
                    pen:  '(pen)',
                    fk:   '(fk)',
                    og:   '(og)',
                    long: '(long)',
                    spec: '(spec)',
                };
                const renderSide = (id, team) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const list = (this.goals || []).filter(g => g.team === team);
                    if (!list.length) { el.innerHTML = ''; return; }
                    el.innerHTML = list.map(g => {
                        const minute = (g.time || '').toString().replace("'", '');
                        const marker = KIND_LABEL[g.kind] || '';
                        const markerCls = g.kind === 'pen' ? 'ms-mark-pen'
                                        : g.kind === 'og'  ? 'ms-mark-og'
                                        :                    'ms-mark';
                        const markerHtml = marker ? ` <span class="${markerCls}">${marker}</span>` : '';
                        const assistHtml = g.assister
                            ? `<span class="ms-assist-line">↳ Asst <span class="ms-assist-name">${g.assister}</span></span>`
                            : '';
                        const tip = `${g.scorer} ${minute}'${marker ? ' ' + marker : ''}${g.assister ? ' · assist ' + g.assister : ''}`;
                        return `<span class="ms-goal" title="${tip}">`
                             +     `<span class="ms-goal-line">`
                             +         `<span class="ms-icon">⚽</span>`
                             +         `<span class="ms-name">${g.scorer}</span>`
                             +         `<span class="ms-min">${minute}'</span>`
                             +         markerHtml
                             +     `</span>`
                             +     assistHtml
                             + `</span>`;
                    }).join('');
                };
                renderSide('playerScorersStrip', 'player');
                renderSide('cpuScorersStrip',    'cpu');
            }

            // Substitutions ticker (under the scorers strip). Reads
            // this.substitutions — each entry has
            //   { team, playerOut, playerIn, time }
            // pushed by confirmSubstitution / _executeAutoSub / substitutionEvent
            // / injuryEvent. Shows the "in / arrow / out / minute" chip per sub.
            _renderSubsStrip() {
                const renderSide = (id, team) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const list = (this.substitutions || []).filter(s => s.team === team);
                    if (!list.length) { el.innerHTML = ''; return; }
                    el.innerHTML = list.map(s => {
                        const minute = (s.time || '').toString().replace("'", '');
                        return `<span class="msub" title="${s.playerIn} on, ${s.playerOut} off (${minute}')">`
                             +     `<span class="msub-in">↑ ${s.playerIn}</span>`
                             +     `<span class="msub-arrow">·</span>`
                             +     `<span class="msub-out">↓ ${s.playerOut}</span>`
                             +     `<span class="msub-min">${minute}'</span>`
                             + `</span>`;
                    }).join('');
                };
                renderSide('playerSubsStrip', 'player');
                renderSide('cpuSubsStrip',    'cpu');
            }

            // Fills the live score chip in the Match Management layout. Reads
            // playerScore/cpuScore, the match minute, and the player's sub
            // quota. Also lists scorers in compact form when there are any.
            // If `scope` is omitted, finds the active Match Mgmt panel itself.
            _renderMatchMgmtScoreChip(scope) {
                const panel = scope || document.querySelector('#managementScreen .mgmt-panel-match');
                if (!panel) return;
                const chip = panel.querySelector('.mm-score-chip');
                if (!chip) return;

                // Hide before kickoff (score is 0–0 and there's no minute yet)
                // and when no CPU team is set (i.e. before a match exists).
                if (this.isPreMatch || !this.cpuTeam) {
                    chip.style.display = 'none';
                    return;
                }
                chip.style.display = 'flex';

                const playerName = this.playerTeam?.clubName || 'You';
                const cpuName    = this.cpuTeam?.clubName    || 'CPU';
                const minute     = this.timeRemaining != null ? this.rules.getMatchMinute(this.timeRemaining) : null;
                const subsUsed   = this.rules?.subCount?.player ?? 0;
                const subsTotal  = this.rules?.MAX_SUBS ?? 5;
                const subsLeft   = Math.max(0, subsTotal - subsUsed);

                chip.querySelector('.mm-score-club').textContent     = playerName;
                chip.querySelector('.mm-score-opponent').textContent = cpuName;
                chip.querySelector('.mm-score-value').textContent    = `${this.playerScore} – ${this.cpuScore}`;
                chip.querySelector('.mm-score-minute').textContent   = minute != null ? `${minute}'` : '';

                const subsEl = chip.querySelector('.mm-score-subs');
                subsEl.textContent = `Subs ${subsLeft}/${subsTotal}`;
                subsEl.style.color = subsLeft > 0 ? '#86EFAC' : '#FCA5A5';
            }

            // Fills the next-match preview chip in the Tactic layout. Uses
            // _findNextUserFixture(). Hidden when no fixture is queued.
            _renderTacticNextMatchChip(scope) {
                const panel = scope || document.querySelector('.ch-view-tactic .mgmt-panel-tactic');
                if (!panel) return;
                const chip = panel.querySelector('.tactic-next-match-chip');
                if (!chip) return;

                const next = this._findNextUserFixture?.();
                if (!next) {
                    chip.style.display = 'none';
                    return;
                }
                chip.style.display = 'flex';

                const { date, match, userClub } = next;
                const userIsHome = match.home === userClub.clubName;
                const opp   = userIsHome ? match.away : match.home;
                const venue = userIsHome ? '(H)' : '(A)';

                chip.querySelector('.next-match-opponent').textContent = `vs ${opp} ${venue}`;
                chip.querySelector('.next-match-date').textContent     = date ? this._formatDate(date) : '';
            }

            // Default importance tier per coarse event type. Specific call sites can override by
            // passing an explicit `priority` argument (e.g. a routine pass is 'low' by default,
            // but a "through ball" or "screamer goal" can call addEvent(...'critical')).
            //   critical → goal, red card, send-off, stretchered injury, penalty/freekick goal
            //   high     → chance / save / bar / miss / spectacular / one-on-one / through-ball
            //   medium   → corner, throw-in, freekick award, yellow card, sub, offside
            //   low      → routine pass / tackle / dribble / goal kick
            //   flavor   → streaker, weather, ball boy, crowd chant, manager argues
            static EVENT_PRIORITY_DEFAULT = {
                goal:    'critical',
                chance:  'high',
                save:    'high',
                card:    'medium',
                injury:  'medium',
                pass:    'low',
                tackle:  'low',
            };

            addEvent(message, type, team = null, priority = null) {
                const eventsLog = document.getElementById('eventsLog');
                const pri = priority || FootballSimulator.EVENT_PRIORITY_DEFAULT[type] || 'low';
                const eventEl = document.createElement('div');
                eventEl.className = `event ${type} event-pri-${pri}`;
                eventEl.dataset.priority = pri;
                eventEl.innerHTML = message;
                if (team === 'player' && this.playerTeam) {
                    const c = this.playerTeam.jerseyColor;
                    const [r, g, b] = [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
                    eventEl.style.background = `rgba(${r},${g},${b},0.18)`;
                    eventEl.style.borderLeft = `3px solid rgba(${r},${g},${b},0.85)`;
                    eventEl.style.color      = '#EEF3EE';
                } else if (team === 'cpu' && this.cpuTeam) {
                    const c = this.cpuTeam.jerseyColor;
                    const [r, g, b] = [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
                    eventEl.style.background = `rgba(${r},${g},${b},0.18)`;
                    eventEl.style.borderLeft = `3px solid rgba(${r},${g},${b},0.85)`;
                    eventEl.style.color      = '#EEF3EE';
                }

                // Hide on the fly if the user has filtered to a higher tier
                const filter = this.eventLogFilter || 'all';
                const rank = { critical: 4, high: 3, medium: 2, low: 1, flavor: 0 };
                const minRank = { all: 0, important: 2, critical: 4 }[filter] || 0;
                if (rank[pri] < minRank) eventEl.style.display = 'none';

                eventsLog.appendChild(eventEl);
                eventsLog.scrollTop = eventsLog.scrollHeight;
            }

            // Re-apply the visibility filter to all existing rows. Called when the user clicks
            // the All / Important / Critical buttons above the event log.
            setEventLogFilter(filter) {
                if (!['all', 'important', 'critical'].includes(filter)) return;
                this.eventLogFilter = filter;
                const rank = { critical: 4, high: 3, medium: 2, low: 1, flavor: 0 };
                const minRank = { all: 0, important: 2, critical: 4 }[filter] || 0;
                document.querySelectorAll('.events-log .event').forEach(el => {
                    const r = rank[el.dataset.priority || 'low'] ?? 1;
                    el.style.display = (r < minRank) ? 'none' : '';
                });
                document.querySelectorAll('.event-log-filter-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.filter === filter);
                });
                // Auto-scroll to bottom after filter change
                const el = document.getElementById('eventsLog');
                if (el) el.scrollTop = el.scrollHeight;
            }

            togglePause() {
                this.isPaused = !this.isPaused;
                // pauseBtn was retired from the match view (Pause now lives in
                // the header dropdown). Keep the legacy lookup tolerant so any
                // remaining ref doesn't throw.
                const pauseBtn = document.getElementById('pauseBtn');
                if (pauseBtn) pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
                this._refreshTopMenuState();
            }

            // Triple-click counter on the match clock — three clicks within 1500 ms toggles debug.
            _registerTimerClick() {
                this._timerClickCount += 1;
                if (this._timerClickTimer) clearTimeout(this._timerClickTimer);
                if (this._timerClickCount >= 3) {
                    this._timerClickCount = 0;
                    this._toggleDebugMode();
                    return;
                }
                this._timerClickTimer = setTimeout(() => { this._timerClickCount = 0; }, 1500);
            }

            _toggleDebugMode() {
                this.debugMode = !this.debugMode;
                const overlay = document.getElementById('debugOverlay');
                const timerEl = document.getElementById('timer');
                if (overlay) overlay.style.display = this.debugMode ? 'grid' : 'none';
                if (timerEl) timerEl.classList.toggle('debug-active', this.debugMode);
                if (this.debugMode) this._updateDebugOverlay();
            }

            // Debug-overlay grid strengths — delegates to ZoneStrength.gridStrengths, supplying
            // the live home-position lookup (matchFlow._home) and the simulator's calculateOverall.
            _computeGridZoneStrengths(bands = 5, lanes = 3) {
                return ZoneStrength.gridStrengths({
                    playerTeam:  this.playerTeam,
                    cpuTeam:     this.cpuTeam,
                    homeLookup:  (idx, isPlayer) => this.matchFlow?._home?.get(isPlayer ? idx : 100 + idx),
                    overallOf:   (p) => this.calculateOverall(p),
                    bands, lanes,
                });
            }

            _updateDebugOverlay() {
                if (!this.debugMode || !this.playerTeam || !this.cpuTeam) return;
                const overlay = document.getElementById('debugOverlay');
                if (!overlay || overlay.style.display === 'none') return;

                const bands = 5, lanes = 3;
                const data  = this._computeGridZoneStrengths(bands, lanes);
                const pColor = this.playerTeam.jerseyColor || '#FFFFFF';
                const cColor = this.cpuTeam.jerseyColor    || '#FFFFFF';

                // CSS-grid order: lanes are rows (top→bottom = top of pitch→bottom),
                // bands are columns (left→right = own-goal→opponent-goal for player team).
                let html = '';
                for (let l = 0; l < lanes; l++) {
                    for (let b = 0; b < bands; b++) {
                        const cell = data[l * bands + b];
                        const coord = `B${b + 1}·L${l + 1}`;
                        const p = cell.player, c = cell.cpu;
                        html += `
                            <div class="debug-cell">
                                <span class="debug-cell-coord">${coord}</span>
                                <span class="debug-num${p == null ? ' empty' : ''}"
                                      style="color:${pColor};">${p == null ? '—' : p}</span>
                                <span class="debug-num${c == null ? ' empty' : ''}"
                                      style="color:${cColor};">${c == null ? '—' : c}</span>
                            </div>`;
                    }
                }
                overlay.innerHTML = html;
            }

            openManagement() {
                this.isPaused = true;
                this._managementOpen = true;
                this.isPreMatch = false;
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                // Open the independent Match Management screen in in-match mode.
                // No _navigateTo — the back/forward nav stack is clubhouse-scoped.
                this._openTacticsView('inMatch');
            }

            // Short-lived notice shown at the top of the management panel.
            // Used for "substitution limit reached" and similar feedback that would
            // otherwise be a silent failure.
            _flashMgmtNotice(msg, kind = 'warn') {
                let el = document.getElementById('mgmtNotice');
                if (!el) {
                    el = document.createElement('div');
                    el.id = 'mgmtNotice';
                    el.style.cssText = 'position:absolute;left:50%;top:60px;transform:translateX(-50%);' +
                        'padding:8px 16px;border-radius:6px;font-size:12px;font-weight:bold;' +
                        'letter-spacing:1px;text-transform:uppercase;z-index:9999;' +
                        'box-shadow:0 4px 14px rgba(0,0,0,0.5);pointer-events:none;' +
                        'transition:opacity 0.3s ease;';
                    document.getElementById('managementScreen')?.appendChild(el);
                }
                const palette = kind === 'warn'
                    ? { bg: '#7c2d12', fg: '#fed7aa', border: '#FF9500' }
                    : { bg: '#14532d', fg: '#86efac', border: '#22c55e' };
                el.style.background = palette.bg;
                el.style.color = palette.fg;
                el.style.border = `1px solid ${palette.border}`;
                el.style.opacity = '1';
                el.textContent = msg;
                clearTimeout(this._mgmtNoticeTimer);
                this._mgmtNoticeTimer = setTimeout(() => {
                    el.style.opacity = '0';
                }, 2400);
            }

            closeManagement() {
                this._managementOpen = false;
                this.isPaused = false;
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                // Popovers (context menu / instructions / arrow picker) live outside the
                // management screen DOM subtree, so they'd persist over the match screen
                // unless we explicitly close them here.
                this._hideAllPlayerPopovers?.();
                // Keep the match-screen pause button in sync — clicking Close always
                // resumes the match, so the label should read "Pause", not stale "Resume".
                const pauseBtn = document.getElementById('pauseBtn');
                if (pauseBtn) pauseBtn.textContent = 'Pause';
                this.switchScreen('matchScreen');
            }

            renderFormationPitch() {
                const scope = this._mgmtScope || this._getActiveMgmtScope();
                const pitch = scope?.querySelector('.formation-pitch');
                if (!pitch || !this.playerTeam) return;

                const formation = this.playerFormation || '442';

                // Pre-defined (x%, y%) coordinates — top = opponent goal, bottom = GK
                // Slot order within each group: left → right
                // 5-mid rows use a slight arc so central mids are higher than wide mids
                const layouts = {
                    '442': [[50,91], [12,76],[36,78],[64,78],[88,76], [12,52],[36,50],[64,50],[88,52], [34,20],[66,20]],
                    '433': [[50,91], [12,76],[36,78],[64,78],[88,76], [24,51],[50,47],[76,51], [18,22],[50,17],[82,22]],
                    '451': [[50,91], [12,76],[36,78],[64,78],[88,76], [8,54],[28,58],[50,47],[72,58],[92,54], [50,17]],
                    '532': [[50,91], [7,70],[26,76],[50,78],[74,76],[93,70], [22,51],[50,47],[78,51], [34,20],[66,20]],
                    '541': [[50,91], [7,70],[26,76],[50,78],[74,76],[93,70], [12,53],[36,51],[64,51],[88,53], [50,17]],
                    '352': [[50,91], [25,77],[50,79],[75,77], [8,55],[28,58],[50,47],[72,58],[92,55], [34,20],[66,20]],
                    '343': [[50,91], [25,77],[50,79],[75,77], [12,53],[36,51],[64,51],[88,53], [18,22],[50,17],[82,22]],
                };
                const coords = layouts[formation] || layouts['442'];

                const formNums = {
                    '442':[4,4,2],'433':[4,3,3],'451':[4,5,1],
                    '532':[5,3,2],'541':[5,4,1],'352':[3,5,2],'343':[3,4,3]
                };
                const [defN, midN, fwdN] = formNums[formation] || [4,4,2];

                // Horizontal ordering weight — used to sort players left → right within each row
                const hw = p => ({ LWB:0,LB:1,LW:1,LM:1, CB:4,CDM:4,CM:4,CAM:5,CF:5,ST:5, RM:7,RW:7,RB:7,RWB:8, GK:4 }[p.position] ?? 4);

                const squad = this.playerTeam.onField;
                const gkGrp  = squad.slice(0, 1);
                const defGrp = [...squad.slice(1, 1+defN)].sort((a,b) => hw(a)-hw(b));
                const midGrp = [...squad.slice(1+defN, 1+defN+midN)].sort((a,b) => hw(a)-hw(b));
                const fwdGrp = [...squad.slice(1+defN+midN)].sort((a,b) => hw(a)-hw(b));

                const ordered = [...gkGrp, ...defGrp, ...midGrp, ...fwdGrp].slice(0, 11);

                const fmtLabels = { '442':'4-4-2','433':'4-3-3','451':'4-5-1','532':'5-3-2','541':'5-4-1','352':'3-5-2','343':'3-4-3' };

                // Build the players' positions list (so we can also draw arrow overlays for them)
                const slotPositions = ordered.map((p, i) => {
                    if (!p || !coords[i]) return null;
                    const [defX, defY] = coords[i];
                    return {
                        p,
                        defX, defY,
                        cx: p.customPos ? p.customPos.x : defX,
                        cy: p.customPos ? p.customPos.y : defY,
                    };
                });

                // CM 01/02-style arrow overlay — long dashed lines from each player's slot to
                // their movement target. Drawn as an SVG that fills the pitch and is non-interactive.
                const arrowsSvg = `
                    <svg class="fm-arrows-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <marker id="fmArrowHead" viewBox="0 0 10 10" markerUnits="userSpaceOnUse"
                                    markerWidth="4" markerHeight="4" refX="8" refY="5" orient="auto">
                                <path d="M0,0 L10,5 L0,10 L2.5,5 Z" fill="#FFD700"/>
                            </marker>
                        </defs>
                        ${slotPositions.map(s => {
                            if (!s) return '';
                            const dir = s.p.instructions?.arrow;
                            if (!dir) return '';
                            const t = this._arrowOffsetForView(dir);
                            if (!t) return '';
                            // Start the line at the OUTER edge of the player card on the side the
                            // arrow points toward (so the line emerges from the front of the
                            // player and continues outward). The slot is approximated as a small
                            // rectangle in pitch-percent (rx≈5.5, ry≈6.5).
                            const len = Math.hypot(t.dx, t.dy);
                            const ux  = t.dx / len, uy = t.dy / len;
                            const rx = 5.5, ry = 6.5;
                            const edge = ux === 0 ? ry
                                       : uy === 0 ? rx
                                       : Math.min(rx / Math.abs(ux), ry / Math.abs(uy));
                            const sx = s.cx + ux * edge;
                            const sy = s.cy + uy * edge;
                            const ex = Math.max(2, Math.min(98, s.cx + t.dx));
                            const ey = Math.max(2, Math.min(98, s.cy + t.dy));
                            return `<line x1="${sx.toFixed(2)}" y1="${sy.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}"
                                          stroke="#FFD700" stroke-width="0.7" stroke-linecap="round"
                                          stroke-dasharray="2,1.4" marker-end="url(#fmArrowHead)"
                                          opacity="0.9"/>`;
                        }).join('')}
                    </svg>
                `;

                pitch.innerHTML = `
                    <div class="fm-field-lines">
                        <div class="fm-line-center"></div>
                        <div class="fm-circle-center"></div>
                        <div class="fm-box-top"></div>
                        <div class="fm-box-bot"></div>
                    </div>
                    ${arrowsSvg}
                    ${slotPositions.map(s => {
                        if (!s) return '';
                        const { p, defX, defY, cx, cy } = s;
                        const lastName  = p.name.trim().split(/\s+/).pop();
                        const ovr       = this.calculateOverall(p);
                        const sel       = this.selectedPlayerOut?.id === p.id;
                        const avatarSVG = AvatarGenerator.createSVG(p.avatar, 34, this._jerseyFor(p, this.playerTeam.jerseyColor));
                        const ovrColor  = this._overallColor(ovr);
                        // Bar shows rolling match-day condition (0–100), not
                        // the static stamina rating. Falls back to 100 for any
                        // fresh-built / un-migrated player.
                        const stamPct = Math.max(0, Math.min(100, Math.round(p.condition ?? 100)));
                        const stamCol = this._staminaColor(stamPct);
                        const moraleCol = this._moraleColor(p.morale);
                        const moraleGl  = this._moraleGlyph(p.morale);
                        const moraleLb  = this._moraleLabel(p.morale);
                        // Show "Natural/Sec1/Sec2". When the player is playing a slot they have
                        // no competence for, tint orange + asterisk as a warning.
                        const competence = this._positionDisplay(p);
                        const oop = this._isOutOfPosition(p);
                        const posHtml = oop
                            ? `<span title="playing ${p.position} — not in their natural/secondary list" style="color:#FF9500;">${competence}*</span>`
                            : competence;
                        return `<button class="fm-player-slot${sel ? ' selected' : ''}${oop ? ' out-of-position' : ''}"
                                style="left:${cx}%;top:${cy}%;transform:translate(-50%,-50%);"
                                draggable="true"
                                data-player-id="${p.id}"
                                data-default-x="${defX}" data-default-y="${defY}">
                            <span class="fm-morale-arrow" title="${moraleLb} form" style="background:${moraleCol};">${this._moraleArrowSVG(p.morale, 14)}</span>
                            <span class="fm-player-ovr-badge" title="Overall ${ovr}" style="background:${ovrColor};">${ovr}</span>
                            <div class="fm-player-avatar">${avatarSVG}</div>
                            <span class="fm-player-name">${lastName}</span>
                            <span class="fm-player-meta">${posHtml}</span>
                            <div class="stamina-bar" title="Stamina ${stamPct}%">
                                <div class="stamina-bar-fill" style="width:${stamPct}%;background:${stamCol};"></div>
                            </div>
                        </button>`;
                    }).join('')}
                    <div class="fm-formation-label">${fmtLabels[formation] || formation}</div>
                `;

                // Wire single-click → context menu, double-click → details overlay.
                // _bindClicks defers the single-click action by 240 ms so a dblclick can cancel it.
                pitch.querySelectorAll('.fm-player-slot').forEach(btn => {
                    const lookup = () => squad.find(pl => pl.id === parseInt(btn.dataset.playerId));
                    this._bindClicks(
                        btn,
                        // single click — keep track of the click point for menu placement
                        () => {
                            const p = lookup();
                            const r = btn.getBoundingClientRect();
                            if (p) this._showPlayerContextMenu(p, r.right, r.top);
                        },
                        // double click — open details overlay directly
                        () => { const p = lookup(); if (p) this.showPlayerDetail(p); }
                    );
                    this._bindSlotDrag(btn, 'xi');
                });
                // Make the pitch area itself a drop target (for repositioning + dropping bench players)
                this._bindPitchDropZone(pitch);
            }

            // Arrow direction → (dx, dy) target offset in formation-pitch percent coords.
            // For the player team the pitch is rendered with the opponent's goal at the TOP,
            // so "forward" decreases y. Lengths are deliberately big (≈20 pitch %) so the line
            // looks like a CM 01/02 run-direction marker, not a tiny icon.
            _arrowOffsetForView(arrow) {
                const LEN  = 20;
                const DIAG = Math.round(LEN * 0.72);   // ≈ LEN / √2
                const map = {
                    'forward':       { dx:  0,    dy: -LEN  },
                    'back':          { dx:  0,    dy:  LEN  },
                    'left':          { dx: -LEN,  dy:  0    },
                    'right':         { dx:  LEN,  dy:  0    },
                    'forward-left':  { dx: -DIAG, dy: -DIAG },
                    'forward-right': { dx:  DIAG, dy: -DIAG },
                    'back-left':     { dx: -DIAG, dy:  DIAG },
                    'back-right':    { dx:  DIAG, dy:  DIAG },
                };
                return map[arrow] || null;
            }

            // Single click vs. double click: defer the single-click action briefly so a
            // following dblclick can cancel it. 240ms matches typical OS double-click thresholds.
            _bindClicks(el, onSingle, onDouble) {
                let timer = null;
                el.addEventListener('click', () => {
                    if (timer) return;
                    timer = setTimeout(() => { timer = null; onSingle(); }, 240);
                });
                el.addEventListener('dblclick', () => {
                    if (timer) { clearTimeout(timer); timer = null; }
                    onDouble();
                });
            }

            // ─── Player context menu (shown on click of a starting-XI slot) ──────────

            _showPlayerContextMenu(player, clientX, clientY) {
                const menu  = document.getElementById('playerContextMenu');
                const title = document.getElementById('playerContextMenuTitle');
                if (!menu || !player) return;

                // Always close any sibling popover first so only one is visible at a time
                this._hideAllPlayerPopovers();

                // Detect whether this is a starter (onField) or a bench player —
                // bench players don't have meaningful Instructions / Arrow actions.
                const isOnField = !!this.playerTeam?.onField?.some(p => p.id === player.id);

                title.textContent = `${player.flag ? player.flag + ' ' : ''}${player.name} (${player.position})`;

                menu.querySelectorAll('.context-menu-item').forEach(btn => {
                    const action = btn.dataset.action;
                    // Hide Instructions + Arrow when the player isn't on the pitch.
                    if (!isOnField && (action === 'instructions' || action === 'arrow')) {
                        btn.style.display = 'none';
                    } else {
                        btn.style.display = '';
                    }
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        this._hideAllPlayerPopovers();
                        if      (action === 'substitute')   this.selectPlayer(player, isOnField);
                        else if (action === 'details')      this.showPlayerDetail(player);
                        else if (action === 'instructions') this._showInstructionsPopover(player);
                        else if (action === 'arrow')        this._showArrowPopover(player);
                    };
                });

                menu.style.display = 'block';
                this._positionPopoverAt(menu, clientX + 6, clientY + 6);
                this._installPopoverDismiss([menu]);
            }

            // Floating instructions popover, anchored next to the player's slot.
            _showInstructionsPopover(player) {
                const menu  = document.getElementById('playerInstructionsMenu');
                const title = document.getElementById('playerInstructionsMenuTitle');
                const body  = document.getElementById('playerInstructionsMenuBody');
                if (!menu || !body || !player) return;
                this._hideAllPlayerPopovers();

                if (!player.instructions) player.instructions = Team.defaultInstructions(player.position);
                title.textContent = `⚙ ${player.name} — Instructions`;

                const isFwd  = ['ST','CF','CAM','LW','RW'].includes(player.position);
                const isWide = ['LB','RB','LWB','RWB','LM','RM','LW','RW'].includes(player.position);
                const isDef  = ['CB','CDM','LB','RB','LWB','RWB','CM','CDM'].includes(player.position);
                const rows = [
                    { key: 'forwardRuns',  label: 'Forward Runs',  opts: ['rarely','mixed','often'] },
                    { key: 'runWithBall',  label: 'Run With Ball', opts: ['rarely','mixed','often'] },
                    { key: 'longShots',    label: 'Long Shots',    opts: ['rarely','mixed','often'] },
                    { key: 'throughBalls', label: 'Through Balls', opts: ['rarely','mixed','often'] },
                    { key: 'crossBall',    label: 'Cross Ball',    opts: ['rarely','mixed','often'], show: isWide },
                    { key: 'holdUpBall',   label: 'Hold Up Ball',  opts: ['no','yes'], show: isFwd },
                    { key: 'tightMarking', label: 'Tight Marking', opts: ['no','yes'], show: isDef },
                    { key: 'freeRole',     label: 'Free Role',     opts: ['no','yes'] },
                    // Per-player overrides of team tactics — 'default' means "follow team"
                    { key: 'mentality',    label: 'Mentality',     opts: ['default','ultra-def','defensive','normal','attacking','gung-ho'] },
                    { key: 'tackling',     label: 'Tackling',      opts: ['default','hard','normal','easy'] },
                    { key: 'passing',      label: 'Passing',       opts: ['default','direct','mixed','short'] },
                ];
                body.innerHTML = rows.filter(r => r.show !== false).map(row => `
                    <div class="tactic-row">
                        <span class="tactic-label">${row.label}</span>
                        <div class="tactic-options">
                            ${row.opts.map(opt => `
                                <button class="tactic-btn${player.instructions[row.key] === opt ? ' active' : ''}"
                                        data-inst="${row.key}" data-value="${opt}" type="button">
                                    ${opt.charAt(0).toUpperCase() + opt.slice(1)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `).join('');

                body.querySelectorAll('button[data-inst]').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const key = btn.dataset.inst, value = btn.dataset.value;
                        this.setPlayerInstruction(player, key, value);
                        body.querySelectorAll(`button[data-inst="${key}"]`).forEach(b => {
                            b.classList.toggle('active', b.dataset.value === value);
                        });
                    };
                });

                menu.style.display = 'block';
                this._positionPopoverNearSlot(menu, player.id);
                this._installPopoverDismiss([menu]);
            }

            // Floating arrow-picker popover.
            _showArrowPopover(player) {
                const menu  = document.getElementById('playerArrowMenu');
                const title = document.getElementById('playerArrowMenuTitle');
                const body  = document.getElementById('playerArrowMenuBody');
                if (!menu || !body || !player) return;
                this._hideAllPlayerPopovers();

                if (!player.instructions) player.instructions = Team.defaultInstructions(player.position);
                title.textContent = `🎯 ${player.name} — Arrow`;

                const layout = [
                    ['forward-left',  'forward',  'forward-right'],
                    ['left',          null,       'right'],
                    ['back-left',     'back',     'back-right'],
                ];
                const glyph = {
                    'forward-left':'↖','forward':'↑','forward-right':'↗',
                    'left':'←','right':'→',
                    'back-left':'↙','back':'↓','back-right':'↘',
                };
                const current = player.instructions?.arrow || null;
                body.innerHTML = `<div class="arrow-picker">${
                    layout.flat().map(dir => `
                        <button class="arrow-picker-cell${dir === current ? ' active' : ''}${dir === null ? ' clear' : ''}"
                                data-dir="${dir === null ? '' : dir}" type="button"
                                title="${dir === null ? 'No arrow' : dir.replace('-', ' ')}">
                            ${dir === null ? '×' : glyph[dir]}
                        </button>
                    `).join('')
                }</div>`;

                body.querySelectorAll('.arrow-picker-cell').forEach(cell => {
                    cell.onclick = (e) => {
                        e.stopPropagation();
                        const dir = cell.dataset.dir || null;
                        this._setPlayerArrow(player, dir);
                        body.querySelectorAll('.arrow-picker-cell').forEach(c => {
                            c.classList.toggle('active', (c.dataset.dir || null) === dir);
                        });
                    };
                });

                menu.style.display = 'block';
                this._positionPopoverNearSlot(menu, player.id);
                this._installPopoverDismiss([menu]);
            }

            // Position a popover so it sits to the right of the player's slot (fallback: left),
            // with viewport clamping.
            _positionPopoverNearSlot(menuEl, playerId) {
                const slot = document.querySelector(`.fm-player-slot[data-player-id="${playerId}"]`);
                if (!slot) return this._positionPopoverAt(menuEl, 60, 60);
                const sRect = slot.getBoundingClientRect();
                const mRect = menuEl.getBoundingClientRect();
                const gap = 8;
                let x = sRect.right + gap;
                let y = sRect.top;
                // If it would overflow right, place to the left of the slot
                if (x + mRect.width > window.innerWidth - 6) x = sRect.left - mRect.width - gap;
                this._positionPopoverAt(menuEl, x, y);
            }

            _positionPopoverAt(menuEl, x, y) {
                const rect = menuEl.getBoundingClientRect();
                const vw = window.innerWidth, vh = window.innerHeight;
                if (x + rect.width  > vw - 6) x = vw - rect.width  - 6;
                if (y + rect.height > vh - 6) y = vh - rect.height - 6;
                menuEl.style.left = `${Math.max(6, x)}px`;
                menuEl.style.top  = `${Math.max(6, y)}px`;
            }

            // Single shared outside-click / Escape dismiss handler. `keepOpen` is the set of
            // popover elements that should NOT be closed by a click on them.
            _installPopoverDismiss(keepOpen) {
                this._removePopoverDismiss();
                this._popoverOutsideHandler = (ev) => {
                    if (keepOpen.some(el => el && el.contains(ev.target))) return;
                    this._hideAllPlayerPopovers();
                };
                this._popoverKeyHandler = (ev) => {
                    if (ev.key === 'Escape') this._hideAllPlayerPopovers();
                };
                setTimeout(() => {
                    document.addEventListener('click', this._popoverOutsideHandler);
                    document.addEventListener('keydown', this._popoverKeyHandler);
                }, 0);
            }

            _removePopoverDismiss() {
                if (this._popoverOutsideHandler) {
                    document.removeEventListener('click', this._popoverOutsideHandler);
                    document.removeEventListener('keydown', this._popoverKeyHandler);
                    this._popoverOutsideHandler = null;
                    this._popoverKeyHandler = null;
                }
            }

            _hideAllPlayerPopovers() {
                ['playerContextMenu', 'playerInstructionsMenu', 'playerArrowMenu'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                this._removePopoverDismiss();
            }

            // Backwards-compat shim: keep the old name working since renderManagementPanel calls it
            _hidePlayerContextMenu() { this._hideAllPlayerPopovers(); }

            // ─── Drag and drop: substitution and on-pitch position adjustment ────────

            // Attach dragstart/dragover/drop/dragend handlers to a player slot or bench item.
            _bindSlotDrag(el, source /* 'xi' | 'bench' */) {
                el.addEventListener('dragstart', (e) => {
                    const id = parseInt(el.dataset.playerId);
                    this._dndPayload = { id, source };
                    el.classList.add('dragging');
                    if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(id));
                    }
                });
                el.addEventListener('dragend', () => {
                    el.classList.remove('dragging');
                    document.querySelectorAll('.drop-target').forEach(n => n.classList.remove('drop-target'));
                });
                // This element is also a drop target — swap when another player is dropped onto it
                el.addEventListener('dragover', (e) => {
                    if (!this._dndPayload) return;
                    e.preventDefault();
                    el.classList.add('drop-target');
                });
                el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
                el.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    el.classList.remove('drop-target');
                    if (!this._dndPayload) return;
                    const dstId = parseInt(el.dataset.playerId);
                    const dst   = source;
                    this._handleDragDrop(this._dndPayload, { id: dstId, source: dst });
                    this._dndPayload = null;
                });
            }

            // The pitch background itself is a drop zone — drop on empty grass to nudge
            // a starter's customPos, or to drop a bench player onto an empty area (becomes a sub
            // requires a target slot, so empty-pitch drops from bench are ignored).
            _bindPitchDropZone(pitchEl) {
                pitchEl.addEventListener('dragover', (e) => {
                    if (!this._dndPayload) return;
                    e.preventDefault();
                    pitchEl.classList.add('drop-active');
                });
                pitchEl.addEventListener('dragleave', (e) => {
                    if (e.target === pitchEl) pitchEl.classList.remove('drop-active');
                });
                pitchEl.addEventListener('drop', (e) => {
                    pitchEl.classList.remove('drop-active');
                    if (!this._dndPayload) return;
                    // If the drop landed on a slot, the slot's own drop handler took it
                    if (e.target.closest('.fm-player-slot')) return;
                    if (this._dndPayload.source !== 'xi') { this._dndPayload = null; return; }
                    e.preventDefault();

                    // Convert mouse position to pitch % coords and update customPos
                    const rect = pitchEl.getBoundingClientRect();
                    const px = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width)  * 100));
                    const py = Math.max(4, Math.min(96, ((e.clientY - rect.top)  / rect.height) * 100));
                    this._adjustPlayerCustomPos(this._dndPayload.id, px, py);
                    this._dndPayload = null;
                });
            }

            _bindBenchDropZone(benchEl) {
                benchEl.addEventListener('dragover', (e) => {
                    if (!this._dndPayload) return;
                    if (this._dndPayload.source !== 'xi') return;   // only XI→bench drops accepted on empty area
                    e.preventDefault();
                    benchEl.classList.add('drop-active');
                });
                benchEl.addEventListener('dragleave', (e) => {
                    if (e.target === benchEl) benchEl.classList.remove('drop-active');
                });
                benchEl.addEventListener('drop', (e) => {
                    benchEl.classList.remove('drop-active');
                    if (!this._dndPayload) return;
                    if (e.target.closest('.player-item')) return;   // a specific bench item handled it
                    // XI → empty bench area: requires a swap partner, so we just no-op
                    this._dndPayload = null;
                });
            }

            // Dispatch a completed drag/drop to the right action.
            _handleDragDrop(src, dst) {
                if (!src || !dst || src.id === dst.id) return;

                // XI ↔ bench: substitute
                if (src.source !== dst.source) {
                    const fromXI = src.source === 'xi' ? src : dst;
                    const toBench = src.source === 'bench' ? src : dst;
                    const xiPlayer = this.playerTeam.onField.find(p => p.id === fromXI.id);
                    const bnPlayer = this.playerTeam.bench.find(p => p.id === toBench.id);
                    if (!xiPlayer || !bnPlayer) return;
                    this.selectedPlayerOut = xiPlayer;
                    this.selectedPlayerIn  = bnPlayer;
                    if (this.isPreMatch || this.rules.canSubstitute('player')) {
                        this.confirmSubstitution();
                    } else {
                        this.selectedPlayerOut = null;
                        this.selectedPlayerIn  = null;
                        this._flashMgmtNotice(`Substitution limit reached (${this.rules.MAX_SUBS}/${this.rules.MAX_SUBS}).`);
                    }
                    return;
                }

                // XI → XI: swap slots (their starting positions trade)
                if (src.source === 'xi' && dst.source === 'xi') {
                    const a = this.playerTeam.onField.findIndex(p => p.id === src.id);
                    const b = this.playerTeam.onField.findIndex(p => p.id === dst.id);
                    if (a === -1 || b === -1) return;
                    const tmp = this.playerTeam.onField[a];
                    this.playerTeam.onField[a] = this.playerTeam.onField[b];
                    this.playerTeam.onField[b] = tmp;
                    // Re-apply slot-expected positions — both swapped players now play their new
                    // slot's role (which may trigger the out-of-position penalty).
                    this.playerTeam.assignSlotPositions(this.playerFormation);
                    this._refreshMatchFlowPlayerInfo();
                    this.renderManagementPanel();
                }
            }

            // Update a player's customPos (free-form drag-within-pitch).
            // Clamped to ±15 from the formation default to keep shape recognisable.
            _adjustPlayerCustomPos(playerId, newX, newY) {
                const p = this.playerTeam?.onField?.find(pl => pl.id === playerId);
                if (!p) return;
                const slot = document.querySelector(`.fm-player-slot[data-player-id="${playerId}"]`);
                const defX = slot ? parseFloat(slot.dataset.defaultX) : newX;
                const defY = slot ? parseFloat(slot.dataset.defaultY) : newY;
                const cx = Math.max(defX - 15, Math.min(defX + 15, newX));
                const cy = Math.max(defY - 15, Math.min(defY + 15, newY));
                p.customPos = { x: cx, y: cy };
                // Keep on-field, bench, roster references in sync (instructions share too)
                ['onField','bench','players'].forEach(k => {
                    const ref = this.playerTeam?.[k]?.find(pl => pl.id === playerId);
                    if (ref && ref !== p) ref.customPos = { x: cx, y: cy };
                });
                this.renderFormationPitch();
            }

            // Set the movement arrow direction on a player and refresh visuals.
            _setPlayerArrow(player, dir /* string or null */) {
                if (!player) return;
                if (!player.instructions) player.instructions = Team.defaultInstructions(player.position);
                player.instructions.arrow = dir;
                ['onField','bench','players'].forEach(k => {
                    const ref = this.playerTeam?.[k]?.find(pl => pl.id === player.id);
                    if (ref && ref !== player) {
                        if (!ref.instructions) ref.instructions = Team.defaultInstructions(ref.position);
                        ref.instructions.arrow = dir;
                    }
                });
                this.renderFormationPitch();
            }

            renderManagementPanel() {
                // The active panel scope (managementScreen's panel or the
                // clubhouse Tactic view's panel). Renderers below take this
                // as an argument so they don't depend on global IDs.
                const scope = this._getActiveMgmtScope();
                if (!scope) return;
                this._mgmtScope = scope;

                // Title + crest live in managementScreen's header (still by ID
                // since there's only one instance of those). The clubhouse
                // Tactic view has its own static "Tactics & XI" header, so we
                // only update mgmt-screen title when we're in that scope.
                // The score chip (mm-score-chip) carries live minute/subs/score
                // info — title stays clean.
                const mode = this._mgmtMode || (this.isPreMatch ? 'kickoff' : 'inMatch');
                if (mode !== 'tactics') {
                    const crestEl = document.getElementById('managementCrest');
                    const titleEl = document.getElementById('managementTitle');
                    if (crestEl && this.playerTeam) {
                        crestEl.innerHTML = this.playerTeam.crestSVGSm;
                    }
                    if (titleEl) {
                        titleEl.textContent = this.isPreMatch
                            ? '⚽ PICK YOUR SQUAD ⚽'
                            : (this.playerTeam?.clubName || '⚽ MATCH MANAGEMENT ⚽');
                    }
                    this._renderMatchMgmtScoreChip(scope);
                } else {
                    this._renderTacticNextMatchChip(scope);
                }

                // Re-renders implicitly close any open detail overlay or floating popover.
                const detailOverlay = scope.querySelector('.player-detail-overlay');
                if (detailOverlay) detailOverlay.style.display = 'none';
                this._hideAllPlayerPopovers?.();

                // Primary action button — content depends on mode. Hidden in
                // 'tactics' since the clubhouse menu already lets you leave.
                if (typeof MgmtComponents !== 'undefined') {
                    if (mode === 'kickoff') {
                        MgmtComponents.setPrimaryAction(scope, {
                            text: '▶ Kick Off Match',
                            onClick: () => this.startMatch(),
                        });
                    } else if (mode === 'inMatch') {
                        MgmtComponents.setPrimaryAction(scope, {
                            text: '← Resume Match',
                            onClick: () => this.closeManagement(),
                        });
                    } else {
                        // tactics — clubhouse menu handles navigation
                        MgmtComponents.setPrimaryAction(scope, { visible: false });
                    }
                }

                // Highlight selected formation button (within this scope only).
                if (this.playerFormation) {
                    scope.querySelectorAll('.formation-btn').forEach(b => {
                        b.classList.toggle('selected', b.dataset.formation === this.playerFormation);
                    });
                }

                // Sync tactic button active states (within this scope only).
                // .tactic-btn[data-tactic]  → team tactic value
                // .tactic-btn[data-autosub] → auto-sub policy value
                scope.querySelectorAll('.tactic-btn[data-tactic]').forEach(b => {
                    b.classList.toggle('active', this.tactics[b.dataset.tactic] === b.dataset.value);
                });
                const autoSubs = this.tactics?.autoSubs || {};
                const autoSubDefaults = { onInjury: 'on', onStamina: 'off', onPerformance: 'off' };
                scope.querySelectorAll('.tactic-btn[data-autosub]').forEach(b => {
                    const cur = autoSubs[b.dataset.autosub] ?? autoSubDefaults[b.dataset.autosub] ?? 'off';
                    b.classList.toggle('active', cur === b.dataset.value);
                });

                // Render formation pitch (right top)
                this.renderFormationPitch();

                // Render bench / player list (left column).
                const benchList = scope.querySelector('.bench-list');
                if (benchList && this.playerTeam) {
                    benchList.innerHTML = '';
                    this.playerTeam.bench.forEach(player => {
                        const playerEl = this.createPlayerElement(player, false);
                        playerEl.setAttribute('draggable', 'true');
                        // Tap a bench player → context menu (Substitute / Details).
                        // This is the touch-friendly path; HTML5 drag still works
                        // on desktop alongside it.
                        playerEl.addEventListener('click', (e) => {
                            const r = playerEl.getBoundingClientRect();
                            this._showPlayerContextMenu(player, r.right, r.top);
                        });
                        this._bindSlotDrag(playerEl, 'bench');
                        benchList.appendChild(playerEl);
                    });
                    this._bindBenchDropZone(benchList);
                }
            }

            createPlayerElement(player, isOnField) {
                const div = document.createElement('div');
                div.className = `player-item ${isOnField ? 'onfield' : ''}`;
                div.dataset.playerId = player.id;

                const avatarSVG = AvatarGenerator.createSVG(player.avatar, 50, this._jerseyFor(player, this.playerTeam?.jerseyColor));
                // Bench bar reads rolling condition — same as pitch slots.
                const stamPct   = Math.max(0, Math.min(100, Math.round(player.condition ?? 100)));
                const stamCol   = this._staminaColor(stamPct);
                const moraleCol = this._moraleColor(player.morale);
                const moraleGl  = this._moraleGlyph(player.morale);
                const moraleLb  = this._moraleLabel(player.morale);

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex-shrink: 0;">
                            ${avatarSVG}
                        </div>
                        <div class="player-info" style="flex: 1;">
                            <div class="player-name">${player.flag ? player.flag + ' ' : ''}${player.name}</div>
                            <div class="player-position">${player.nationality ? player.nationality + ' · ' : ''}${this._positionDisplay(player)} · <span style="font-weight:600;color:var(--c-text-1);">#${player.number}</span> <span class="morale-arrow" title="${moraleLb} form">${this._moraleArrowSVG(player.morale, 14)}</span></div>
                            <div class="stamina-bar" title="Stamina ${stamPct}%">
                                <div class="stamina-bar-fill" style="width:${stamPct}%;background:${stamCol};"></div>
                            </div>
                        </div>
                        <div class="player-number" style="color:${this._overallColor(this.calculateOverall(player))};">${this.calculateOverall(player)}</div>
                    </div>
                `;

                // Click handlers (single = sub, double = view details) are wired by the caller.
                return div;
            }

            selectPlayer(player, isOnField) {
                if (isOnField) {
                    // Deselect if clicking the same player
                    if (this.selectedPlayerOut?.id === player.id) {
                        this.selectedPlayerOut = null;
                    } else {
                        this.selectedPlayerOut = player;
                    }
                } else {
                    if (this.selectedPlayerIn?.id === player.id) {
                        this.selectedPlayerIn = null;
                    } else {
                        this.selectedPlayerIn = player;
                    }
                }

                this.updateSelectionUI();

                // Auto-confirm: as soon as both a starting XI player and a bench player
                // are selected (either order), swap them immediately.
                if (this.selectedPlayerOut && this.selectedPlayerIn) {
                    const allowed = this.isPreMatch || this.rules.canSubstitute('player');
                    if (allowed) this.confirmSubstitution();
                }
            }

            updateSelectionUI() {
                document.querySelectorAll('.player-item, .fm-player-slot').forEach(el => {
                    el.classList.remove('selected');
                });

                if (this.selectedPlayerOut) {
                    document.querySelector(`[data-player-id="${this.selectedPlayerOut.id}"]`)?.classList.add('selected');
                }

                if (this.selectedPlayerIn) {
                    document.querySelector(`[data-player-id="${this.selectedPlayerIn.id}"]`)?.classList.add('selected');
                }

                // Info bar + Confirm button were removed — selection is purely visual now
                // (auto-confirm swaps as soon as both ends are picked).
            }

            confirmSubstitution() {
                if (!this.selectedPlayerOut || !this.selectedPlayerIn) return;

                // During a live match, enforce the substitution quota
                if (!this.isPreMatch && !this.rules.canSubstitute('player')) return;

                const outIndex = this.playerTeam.onField.findIndex(p => p.id === this.selectedPlayerOut.id);
                if (outIndex === -1) {
                    // Player is no longer on field (e.g. sent off between opening panel and confirming)
                    this.selectedPlayerOut = null;
                    this.selectedPlayerIn  = null;
                    this.updateSelectionUI();
                    return;
                }
                this.playerTeam.onField[outIndex] = { ...this.selectedPlayerIn, isOnField: true };

                const inIndex = this.playerTeam.bench.findIndex(p => p.id === this.selectedPlayerIn.id);
                if (inIndex !== -1) this.playerTeam.bench[inIndex] = this.selectedPlayerOut;

                // Reset the outgoing player back to their natural position label, and force the
                // incoming player into the slot's expected role (with efficiency penalty if they
                // don't naturally fit).
                this.selectedPlayerOut.position = this.selectedPlayerOut.naturalPosition || this.selectedPlayerOut.position;
                this.playerTeam.assignSlotPositions(this.playerFormation);

                if (!this.isPreMatch) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    this.rules.recordSub('player');
                    this.substitutions.push({ team: 'player', playerOut: this.selectedPlayerOut.name, playerIn: this.selectedPlayerIn.name, time: `${minute}'` });
                    this.addEvent(`🔄 Sub (${minute}'): <b class="ev-name">${this.selectedPlayerOut.name}</b> off, <b class="ev-name">${this.selectedPlayerIn.name}</b> on!`, 'tackle', 'player', 'medium');
                    // Track minutes played for both sides of the swap.
                    this._statSubOff(this.selectedPlayerOut);
                    this._statSubOn(this.selectedPlayerIn);
                    this._renderSubsStrip?.();   // instant chip update
                }

                this.selectedPlayerOut = null;
                this.selectedPlayerIn  = null;

                // Sub changed who's on the pitch → refresh MatchFlow's id→player map so
                // the new player's instructions drive their movement.
                this._refreshMatchFlowPlayerInfo();

                // Re-render in place — don't auto-close mid-match so the user can chain
                // more subs / tweak tactics without re-opening the panel each time.
                this.renderManagementPanel();
            }

            showCelebration(scorer, team) {
                const celebrationScreen = document.getElementById('celebrationScreen');
                const scoringTeam = team === 'player' ? this.playerTeam : this.cpuTeam;
                const goalScorer = scorer;

                // Banner info
                document.getElementById('celPlayerName').textContent = this.playerTeam.clubName;
                document.getElementById('celScoreLine').textContent  = `${this.playerScore} - ${this.cpuScore}`;
                document.getElementById('celCpuName').textContent    = this.cpuTeam.clubName;

                // Scorer figure
                const scorerWrap = document.getElementById('celScorerWrap');
                scorerWrap.innerHTML = '';
                if (goalScorer) {
                    const fig = document.createElement('div');
                    fig.className = 'cel-scorer-fig';
                    fig.innerHTML = AvatarGenerator.createSVG(goalScorer.avatar, 110, scoringTeam.jerseyColor);
                    const lbl = document.createElement('div');
                    lbl.className = 'cel-scorer-name';
                    lbl.textContent = (goalScorer.flag ? goalScorer.flag + ' ' : '') + goalScorer.name;
                    scorerWrap.appendChild(fig);
                    scorerWrap.appendChild(lbl);
                }

                // Teammates (3 from scoring team, split 2 left / 1 right)
                const matesLeft  = document.getElementById('celMatesLeft');
                const matesRight = document.getElementById('celMatesRight');
                matesLeft.innerHTML  = '';
                matesRight.innerHTML = '';

                const mates = scoringTeam.onField
                    .filter(p => !goalScorer || p.id !== goalScorer.id)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3);

                mates.forEach((m, i) => {
                    const d = document.createElement('div');
                    d.className = 'cel-mate';
                    d.style.animationDelay = (i * 0.18) + 's';
                    d.innerHTML = AvatarGenerator.createSVG(m.avatar, 72, scoringTeam.jerseyColor);
                    (i < 2 ? matesLeft : matesRight).appendChild(d);
                });

                celebrationScreen.style.display = 'block';
                this.isPaused = true;
                this._runConfetti();

                setTimeout(() => {
                    this._stopConfetti();
                    celebrationScreen.style.display = 'none';
                    // Don't resume if the user opened the Management Panel during the celebration.
                    if (!this._managementOpen) this.isPaused = false;
                }, 5000);
            }

            _runConfetti() {
                const canvas = document.getElementById('celCanvas');
                if (!canvas) return;
                canvas.width  = canvas.offsetWidth  || window.innerWidth;
                canvas.height = canvas.offsetHeight || window.innerHeight;
                const ctx = canvas.getContext('2d');
                const COLORS = ['#FFD700','#FF4444','#44AAFF','#44FF88','#FF88CC','#FF8800','#FFFFFF'];
                const pieces = Array.from({length: 120}, () => ({
                    x:  Math.random() * canvas.width,
                    y:  Math.random() * -canvas.height,
                    w:  6 + Math.random() * 8,
                    h:  4 + Math.random() * 6,
                    r:  Math.random() * Math.PI * 2,
                    dr: (Math.random() - 0.5) * 0.18,
                    vx: (Math.random() - 0.5) * 2.4,
                    vy: 2.8 + Math.random() * 3.2,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    circle: Math.random() > 0.6,
                }));
                let alive = true;
                this._confettiStop = () => { alive = false; ctx.clearRect(0, 0, canvas.width, canvas.height); };
                const tick = () => {
                    if (!alive) return;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    for (const p of pieces) {
                        p.x += p.vx; p.y += p.vy; p.r += p.dr;
                        if (p.y > canvas.height) { p.y = -p.h; p.x = Math.random() * canvas.width; }
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.r);
                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = 0.88;
                        if (p.circle) {
                            ctx.beginPath();
                            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                            ctx.fill();
                        } else {
                            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                        }
                        ctx.restore();
                    }
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }

            _stopConfetti() {
                if (this._confettiStop) { this._confettiStop(); this._confettiStop = null; }
            }

            endMatch() {
                this.isRunning = false;
                if (this.matchFlow) { this.matchFlow.stop(); this.matchFlow = null; }
                document.getElementById('stats').style.display = 'grid';
                // pauseBtn + endBtn were removed from the match view in favour of
                // the header Pause control. Lookups stay optional so old DOM (if
                // any caller re-injects it) still works.
                document.getElementById('pauseBtn')?.style?.setProperty('display', 'none');
                document.getElementById('endBtn')?.style?.setProperty('display', 'block');
                this._refreshTopMenuState();

                this._finalizePlayerStats();   // close minute counters for everyone still on
                this._computeAllRatings();     // 1.0–10.0 rating for every featured player
                this.audio?.whistle(false);    // long full-time whistle

                // ── Persist the result + the updated player team ───────────────
                if (typeof GameStorage !== 'undefined') {
                    try {
                        // Snapshot every player who featured (minutesPlayed > 0) for
                        // the saved history entry, so the Match History detail view
                        // can render line-ups + ratings without needing the full
                        // team objects.
                        const snapTeam = (teamObj) => {
                            if (!teamObj) return null;
                            const lineup = (teamObj.players || [])
                                .filter(p => p.stats?.minutesPlayed > 0)
                                .map(p => ({
                                    name:     p.name,
                                    position: p.position,
                                    number:   p.number,
                                    rating:   p.stats?.rating || 0,
                                    minutes:  Math.round(p.stats?.minutesPlayed || 0),
                                    goals:    p.stats?.goalsScored  || 0,
                                    assists:  p.stats?.assistsGiven || 0,
                                    shots:    p.stats?.shots        || 0,
                                    shotsOnTarget: p.stats?.shotsOnTarget || 0,
                                    passes:   p.stats?.passes       || 0,
                                    passesCompleted: p.stats?.passesCompleted || 0,
                                    tackles:  p.stats?.tackles      || 0,
                                    dribbles: p.stats?.dribbles     || 0,
                                    fouls:    p.stats?.fouls        || 0,
                                    yellowCards: p.stats?.yellowCards || 0,
                                    redCards:    p.stats?.redCards    || 0,
                                }))
                                .sort((a, b) => b.rating - a.rating);
                            return {
                                clubName:    teamObj.clubName,
                                jerseyColor: teamObj.jerseyColor,
                                lineup,
                            };
                        };

                        GameStorage.appendHistory({
                            playerTeam:      this.playerTeam?.clubName,
                            cpuTeam:         this.cpuTeam?.clubName,
                            playerScore:     this.playerScore,
                            cpuScore:        this.cpuScore,
                            playerFormation: this.playerFormation,
                            cpuFormation:    this.cpuFormation,
                            goals: (this.goals || []).map(g => ({
                                team: g.team, scorer: g.scorer, assister: g.assister, minute: parseInt(g.time, 10),
                            })),
                            cards: {
                                player: (this.cardData?.player || []).slice(),
                                cpu:    (this.cardData?.cpu    || []).slice(),
                            },
                            substitutions: (this.substitutions || []).slice(),
                            teamStats: { ...this.stats },
                            playerLineup: snapTeam(this.playerTeam),
                            cpuLineup:    snapTeam(this.cpuTeam),
                        });
                        if (this.playerTeam) {
                            // Carry per-match goals/assists onto each player's
                            // career counter (top-level p.goals/p.assists) before
                            // saving, since live-match increments target the
                            // shallow onField copies, not the canonical roster.
                            this._mergeMatchStatsIntoCareer(this.playerTeam);
                            GameStorage.savePlayerTeam(this.playerTeam.serialize());
                        }
                        if (this.cpuTeam) {
                            this._mergeMatchStatsIntoCareer(this.cpuTeam);
                        }
                        // Persist the league so the CPU club's roster (now with
                        // updated per-player career goals/assists from this match)
                        // is available to the next render of the leaderboard.
                        const league = GameStorage.loadLeague?.();
                        if (Array.isArray(league)) GameStorage.saveLeague(league);
                    } catch (e) {
                        console.warn('endMatch: persist failed', e?.message);
                    }
                }

                this._inMatch = false;          // clubhouse access restored
                this.switchScreen('resultScreen');
                this.displayResult();
            }

            // Render the two per-team performance columns on the result screen.
            _renderPlayerPerformanceTable() {
                const section = document.getElementById('playerStatsSection');
                if (!section) return;

                const renderCol = (containerId, team) => {
                    const el = document.getElementById(containerId);
                    if (!el || !team) return;
                    // Stats live on each player; filter to those who actually appeared.
                    const players = team.players
                        .map(p => ({ p, s: p.stats }))
                        .filter(x => x.s && x.s.minutesPlayed > 0)
                        .sort((a, b) => b.s.minutesPlayed - a.s.minutesPlayed);

                    el.innerHTML = `
                        <div class="ps-team-head">${team.clubName}</div>
                        <div class="player-stats-row header">
                            <span>Player</span>
                            <span class="ps-num">Min</span>
                            <span class="ps-num">Sht</span>
                            <span class="ps-num">Pas</span>
                            <span class="ps-num">Drb</span>
                            <span class="ps-num">Duel</span>
                        </div>
                        ${players.map(({ p, s }) => {
                            const dim = v => v === 0 ? ' zero' : '';
                            return `
                                <div class="player-stats-row" title="${this._positionDisplayPlain(p)}">
                                    <span class="ps-name">${p.flag ? p.flag + ' ' : ''}${p.name}</span>
                                    <span class="ps-num">${Math.round(s.minutesPlayed)}'</span>
                                    <span class="ps-num${dim(s.shots)}">${s.shots}</span>
                                    <span class="ps-num${dim(s.passes)}">${s.passes}</span>
                                    <span class="ps-num${dim(s.dribbles)}">${s.dribbles}</span>
                                    <span class="ps-num${dim(s.duelsWon)}">${s.duelsWon}</span>
                                </div>
                            `;
                        }).join('')}
                    `;
                };

                renderCol('playerStatsLeft',  this.playerTeam);
                renderCol('playerStatsRight', this.cpuTeam);
                section.style.display = 'block';
            }

            displayResult() {
                // Team crests + score
                const teamsEl = document.getElementById('resultTeamsDisplay');
                if (teamsEl && this.playerTeam && this.cpuTeam) {
                    teamsEl.innerHTML = `
                        <div class="result-team">
                            ${this.playerTeam.crestSVG}
                            <div class="result-team-name">${this.playerTeam.clubName}</div>
                        </div>
                        <div class="result-score-display">${this.playerScore} - ${this.cpuScore}</div>
                        <div class="result-team">
                            ${this.cpuTeam.crestSVG}
                            <div class="result-team-name">${this.cpuTeam.clubName}</div>
                        </div>
                    `;
                }

                const resultEl = document.getElementById('resultMessage');
                let resultClass, message;

                if (this.playerScore > this.cpuScore) {
                    resultClass = 'win';
                    message = '🎉 Victory!';
                } else if (this.playerScore < this.cpuScore) {
                    resultClass = 'loss';
                    message = '😢 Defeat!';
                } else {
                    resultClass = 'draw';
                    message = '🤝 Draw!';
                }

                resultEl.className = `result-message ${resultClass}`;
                resultEl.textContent = message;

                document.getElementById('finalPlayerScore').textContent = this.playerScore;
                document.getElementById('finalCpuScore').textContent = this.cpuScore;
                document.getElementById('finalPlayerShots').textContent = this.stats.playerShots;
                document.getElementById('finalCpuShots').textContent = this.stats.cpuShots;
                document.getElementById('finalPlayerPoss').textContent = Math.round(this.stats.playerPossession);
                document.getElementById('finalCpuPoss').textContent = Math.round(this.stats.cpuPossession);
                document.getElementById('finalPlayerPasses').textContent = this.stats.playerPasses;
                document.getElementById('finalCpuPasses').textContent = this.stats.cpuPasses;

                // Display goals
                if (this.goals.length > 0) {
                    const goalsList = document.getElementById('goalsList');
                    goalsList.innerHTML = '';

                    this.goals.forEach(goal => {
                        const goalEl = document.createElement('div');
                        goalEl.style.cssText = 'padding: 10px; margin-bottom: 7px; background: rgba(74,222,128,0.08); border-radius: 5px; font-size: 13px; border-left: 3px solid #4ADE80; color: #EEF3EE;';

                        const team = goal.team === 'player' ? '👤 You' : '🤖 CPU';
                        const assistText = goal.assister ? ` (assist: ${goal.assister})` : '';
                        goalEl.innerHTML = `<strong style="color:#FFD700">${team}</strong> - ${goal.scorer}${assistText} <span style="float: right; color: #90ADA0;">${goal.time}'</span>`;

                        goalsList.appendChild(goalEl);
                    });

                    document.getElementById('goalsSection').style.display = 'block';
                }

                // Display substitutions
                if (this.substitutions.length > 0) {
                    const subsList = document.getElementById('substitutionsList');
                    subsList.innerHTML = '';

                    this.substitutions.forEach(sub => {
                        const subEl = document.createElement('div');
                        subEl.style.cssText = 'padding: 10px; margin-bottom: 7px; background: rgba(68,153,255,0.08); border-radius: 5px; font-size: 13px; border-left: 3px solid #4499FF; color: #EEF3EE;';

                        const team = sub.team === 'player' ? '👤 You' : '🤖 CPU';
                        subEl.innerHTML = `<strong style="color:#FFD700">${team}</strong> - ${sub.playerOut} <span style="color:#FF4444;">→ off</span>, ${sub.playerIn} <span style="color:#4ADE80;">→ on</span> <span style="float: right; color: #90ADA0;">${sub.time}'</span>`;

                        subsList.appendChild(subEl);
                    });

                    document.getElementById('substitutionsSection').style.display = 'block';
                }

                // Display cards
                const allCards = [...(this.cardData.player || []), ...(this.cardData.cpu || [])];
                if (allCards.length > 0) {
                    const cardsList = document.getElementById('cardsList');
                    cardsList.innerHTML = '';

                    this.cardData.player.forEach(card => {
                        const cardEl = document.createElement('div');
                        cardEl.style.cssText = 'padding: 10px; margin-bottom: 7px; background: rgba(255,153,0,0.08); border-radius: 5px; font-size: 13px; border-left: 3px solid #FF9900; color: #EEF3EE;';

                        const cardIcon = card.type === 'red' ? '🔴' : '🟡';
                        const cardType = card.type === 'red' ? 'RED CARD' : 'YELLOW CARD';
                        cardEl.innerHTML = `<strong style="color:#FFD700">👤 You</strong> - ${cardIcon} ${cardType} to ${card.player}`;

                        cardsList.appendChild(cardEl);
                    });

                    this.cardData.cpu.forEach(card => {
                        const cardEl = document.createElement('div');
                        cardEl.style.cssText = 'padding: 10px; margin-bottom: 7px; background: rgba(255,153,0,0.08); border-radius: 5px; font-size: 13px; border-left: 3px solid #FF9900; color: #EEF3EE;';

                        const cardIcon = card.type === 'red' ? '🔴' : '🟡';
                        const cardType = card.type === 'red' ? 'RED CARD' : 'YELLOW CARD';
                        cardEl.innerHTML = `<strong style="color:#FFD700">🤖 CPU</strong> - ${cardIcon} ${cardType} to ${card.player}`;

                        cardsList.appendChild(cardEl);
                    });

                    document.getElementById('cardsSection').style.display = 'block';
                }

                // Per-player performance table — minutes / shots / passes / dribbles / duels
                this._renderPlayerPerformanceTable();
            }

            reset() {
                if (this.matchFlow) { this.matchFlow.stop(); this.matchFlow = null; }
                this.isPreMatch = true;
                this.playerFormation = '442';
                this.cpuFormation = null;
                // "Play again" should keep the career squad + tactics if persisted.
                // resetCareer() wipes that storage so this falls back to fresh generation.
                const savedTactics = (typeof GameStorage !== 'undefined') ? GameStorage.loadTactics() : null;
                if (savedTactics?.formation) this.playerFormation = savedTactics.formation;
                const savedTeam = (typeof GameStorage !== 'undefined') ? GameStorage.loadPlayerTeam() : null;
                if (savedTeam && Array.isArray(savedTeam.players) && savedTeam.players.length) {
                    this.playerTeam = new Team('You', null, savedTeam);
                } else {
                    this.playerTeam = new Team('You');
                }
                this.playerTeam.setupSquad(this.playerFormation);
                this.cpuTeam = null;
                this.playerScore = 0;
                this.cpuScore = 0;
                this.timeRemaining = 60;
                this.isRunning = false;
                this.isPaused = false;
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                this.goals = [];
                this.substitutions = [];
                this.cardData = { player: [], cpu: [] };
                this.teamInstruction = 'neutral';
                this._cpuLastFormationChangeMinute = 0;
                this.tactics = { mentality: 'normal', closingDown: 'standard', tackling: 'normal', passing: 'mixed', marking: 'zonal', timeWasting: 'mixed', counterAttack: 'no', autoSubs: { onInjury: 'on', onStamina: 'off', onPerformance: 'off' } };
                if (savedTactics?.tactics) this.tactics = { ...this.tactics, ...savedTactics.tactics };
                this.momentum = 50;
                this._attackPhase = null;
                this._attackTeam  = null;
                this._phaseTicks  = 0;
                this.rules.reset();
                this.stats = {
                    playerShots: 0, cpuShots: 0,
                    playerShotsOnTarget: 0, cpuShotsOnTarget: 0,
                    playerTackles: 0, cpuTackles: 0,
                    playerPasses: 0, cpuPasses: 0,
                    playerPassesCompleted: 0, cpuPassesCompleted: 0,
                    playerCorners: 0, cpuCorners: 0,
                    playerFouls: 0, cpuFouls: 0,
                    playerOffsides: 0, cpuOffsides: 0,
                    playerFreeKicks: 0, cpuFreeKicks: 0,
                    playerPossession: 50, cpuPossession: 50,
                };

                // pauseBtn + endBtn were removed from the match view; optional-chained.
                document.getElementById('pauseBtn')?.style?.setProperty('display', 'block');
                const pb = document.getElementById('pauseBtn'); if (pb) pb.textContent = 'Pause';
                document.getElementById('manageBtn').style.display = 'none';
                document.getElementById('endBtn')?.style?.setProperty('display', 'none');
                document.getElementById('stats').style.display = 'none';
                document.getElementById('eventsLog').innerHTML = '<div class="event pass">⚪ Match started! Possession: 50-50</div>';
                // Reset tactic buttons to defaults
                document.querySelectorAll('.tactic-btn').forEach(b => b.classList.remove('active'));
                [['mentality','normal'],['closingDown','standard'],['tackling','normal'],['passing','mixed']].forEach(([k,v]) => {
                    const btn = document.querySelector(`.tactic-btn[data-tactic="${k}"][data-value="${v}"]`);
                    if (btn) btn.classList.add('active');
                });

                this._openTacticsView();
            }

            // Wipes the saved manager profile, player team, tactics, and match
            // history — does NOT touch settings (mute / volume / speed) — then
            // resets the simulator with a freshly-generated squad and sends
            // the user back to the onboarding step 1. Callable from console:
            //   game.resetCareer()
            resetCareer() {
                if (typeof GameStorage !== 'undefined') {
                    GameStorage.resetCareer();   // wipes manager + team + tactics + history
                }
                this._inMatch = false;           // clear the in-match guard
                this.reset();
                this._refreshManagerLabel();      // title falls back to generic label
                this._refreshDateLabel();         // and the date chip
                this._showOnboarding();           // back to step 1 (choose manager name)
                console.log('Career reset — onboarding shown.');
            }
        }

        function bootstrapSimulator() {
            console.log('Initializing Football Simulator...');
            try {
                window.game = new FootballSimulator();
                console.log('Football Simulator initialized successfully');
                console.log('Game object available at window.game');
                document.body.style.opacity = '1'; // Ensure page is visible
            } catch (error) {
                console.error('Error initializing Football Simulator:', error);
                console.error('Stack:', error.stack);
                alert('FATAL ERROR during initialization:\n\n' + error.message + '\n\nCheck browser console (F12) for more details.');
                document.body.innerHTML = '<div style="padding: 20px; font-family: monospace; color: red;"><h1>Game Initialization Failed</h1><p>Error: ' + error.message + '</p><p>Stack: ' + error.stack + '</p></div>';
            }
        }

        // Wait for screens/<name>.html partials to inject into the page before
        // querying DOM nodes inside them. The loader (screens/screen-loader.js)
        // exposes window.__screensReady (a Promise) and dispatches 'screensReady'.
        // If the loader is absent (e.g. someone opened the page without it),
        // bootstrap immediately as the legacy path.
        if (window.__screensReady && typeof window.__screensReady.then === 'function') {
            window.__screensReady.then(bootstrapSimulator, () => { /* loader already showed the error */ });
        } else {
            bootstrapSimulator();
        }
