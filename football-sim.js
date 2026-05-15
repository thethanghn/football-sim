        class PitchRenderer {
            constructor() {
                this.width = 800;
                this.height = 500;
                this.pitchWidth = 100;
                this.pitchHeight = 100;
                this.svg = null;
                this.playerVisuals = {};
                this.ballElement = null;
            }

            createPitchSVG(containerId) {
                const container = document.getElementById(containerId);
                if (!container) return;

                this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
                this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                this.svg.style.width = '100%';
                this.svg.style.height = '100%';

                container.innerHTML = '';
                container.appendChild(this.svg);

                this.drawPitchLines();
                return this.svg;
            }

            drawPitchLines() {
                const svg = this.svg;
                const w = this.width;
                const h = this.height;
                const margin = 20;

                // Pitch background
                const pitch = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                pitch.setAttribute('x', margin);
                pitch.setAttribute('y', margin);
                pitch.setAttribute('width', w - 2*margin);
                pitch.setAttribute('height', h - 2*margin);
                pitch.setAttribute('fill', '#1a7a1a');
                pitch.setAttribute('stroke', '#fff');
                pitch.setAttribute('stroke-width', '2');
                svg.appendChild(pitch);

                const x1 = margin, x2 = w - margin, y1 = margin, y2 = h - margin;
                const xMid = (x1 + x2) / 2, yMid = (y1 + y2) / 2;
                const lineColor = '#fff';

                // Helper function to add line
                const addLine = (x1, y1, x2, y2) => {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x1);
                    line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2);
                    line.setAttribute('y2', y2);
                    line.setAttribute('stroke', lineColor);
                    line.setAttribute('stroke-width', '1.5');
                    svg.appendChild(line);
                };

                // Center line
                addLine(xMid, y1, xMid, y2);

                // Center circle
                const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                centerCircle.setAttribute('cx', xMid);
                centerCircle.setAttribute('cy', yMid);
                centerCircle.setAttribute('r', '40');
                centerCircle.setAttribute('fill', 'none');
                centerCircle.setAttribute('stroke', lineColor);
                centerCircle.setAttribute('stroke-width', '1.5');
                svg.appendChild(centerCircle);

                // Center spot
                const centerSpot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                centerSpot.setAttribute('cx', xMid);
                centerSpot.setAttribute('cy', yMid);
                centerSpot.setAttribute('r', '3');
                centerSpot.setAttribute('fill', lineColor);
                svg.appendChild(centerSpot);

                // Goal boxes and penalty areas
                const boxWidth = 150;
                const boxHeight = 100;
                const goalAreaHeight = 50;

                // Left penalty area
                this.drawBox(x1, yMid - boxHeight/2, boxWidth, boxHeight, svg, lineColor);
                // Right penalty area
                this.drawBox(x2 - boxWidth, yMid - boxHeight/2, boxWidth, boxHeight, svg, lineColor);

                // Left goal area
                this.drawBox(x1, yMid - goalAreaHeight/2, 60, goalAreaHeight, svg, lineColor);
                // Right goal area
                this.drawBox(x2 - 60, yMid - goalAreaHeight/2, 60, goalAreaHeight, svg, lineColor);

                // Corner arcs
                this.drawCornerArc(x1, y1, 20, svg, lineColor);
                this.drawCornerArc(x2, y1, 20, svg, lineColor);
                this.drawCornerArc(x1, y2, 20, svg, lineColor);
                this.drawCornerArc(x2, y2, 20, svg, lineColor);
            }

            drawBox(x, y, width, height, svg, color) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', width);
                rect.setAttribute('height', height);
                rect.setAttribute('fill', 'none');
                rect.setAttribute('stroke', color);
                rect.setAttribute('stroke-width', '1.5');
                svg.appendChild(rect);
            }

            drawCornerArc(x, y, r, svg, color) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const dir = x > this.width / 2 ? -1 : 1;
                const dirV = y > this.height / 2 ? -1 : 1;
                path.setAttribute('d', `M ${x + dir*r} ${y} A ${r} ${r} 0 0 ${dirV > 0 ? 0 : 1} ${x} ${y + dirV*r}`);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', color);
                path.setAttribute('stroke-width', '1.5');
                svg.appendChild(path);
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

            renderPlayer(playerId, x, y, playerNumber, color, playerName) {
                const coords = this.getPixelCoords(x, y);
                const radius = 8;
                const isTeam1 = playerId < 100;
                const teamColor = color || (isTeam1 ? '#FF0000' : '#0000FF');

                const playerG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                playerG.setAttribute('id', `player-${playerId}`);
                playerG.setAttribute('data-player-id', playerId);

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', coords.x);
                circle.setAttribute('cy', coords.y);
                circle.setAttribute('r', radius);
                circle.setAttribute('fill', teamColor);
                circle.setAttribute('stroke', '#fff');
                circle.setAttribute('stroke-width', '1');
                playerG.appendChild(circle);

                const numText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                numText.setAttribute('x', coords.x);
                numText.setAttribute('y', coords.y);
                numText.setAttribute('text-anchor', 'middle');
                numText.setAttribute('dominant-baseline', 'middle');
                numText.setAttribute('font-size', '7');
                numText.setAttribute('font-weight', 'bold');
                numText.setAttribute('fill', '#fff');
                numText.textContent = playerNumber;
                playerG.appendChild(numText);

                if (playerName) {
                    const shortName = playerName.split(' ').pop();
                    const nameBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    nameText.setAttribute('x', coords.x);
                    nameText.setAttribute('y', coords.y + radius + 13);
                    nameText.setAttribute('text-anchor', 'middle');
                    nameText.setAttribute('dominant-baseline', 'middle');
                    nameText.setAttribute('font-size', '11');
                    nameText.setAttribute('font-weight', 'bold');
                    nameText.setAttribute('fill', '#fff');
                    nameText.textContent = shortName;
                    // background pill behind name
                    const approxW = shortName.length * 6.5 + 6;
                    nameBg.setAttribute('x', coords.x - approxW / 2);
                    nameBg.setAttribute('y', coords.y + radius + 4);
                    nameBg.setAttribute('width', approxW);
                    nameBg.setAttribute('height', 18);
                    nameBg.setAttribute('rx', '4');
                    nameBg.setAttribute('fill', 'rgba(0,0,0,0.65)');
                    playerG.appendChild(nameBg);
                    playerG.appendChild(nameText);
                }

                // Stamina bar above the player circle (background + filled portion).
                // The fill width and color are updated live as stamina drains during the match.
                const STAM_W = 16, STAM_H = 2.5;
                const stamBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                stamBg.setAttribute('x', coords.x - STAM_W / 2);
                stamBg.setAttribute('y', coords.y - radius - 6);
                stamBg.setAttribute('width',  STAM_W);
                stamBg.setAttribute('height', STAM_H);
                stamBg.setAttribute('rx', 1);
                stamBg.setAttribute('fill', 'rgba(0,0,0,0.65)');
                stamBg.setAttribute('stroke', 'rgba(255,255,255,0.4)');
                stamBg.setAttribute('stroke-width', '0.3');
                playerG.appendChild(stamBg);

                const stamFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                stamFill.setAttribute('x', coords.x - STAM_W / 2);
                stamFill.setAttribute('y', coords.y - radius - 6);
                stamFill.setAttribute('width',  STAM_W);
                stamFill.setAttribute('height', STAM_H);
                stamFill.setAttribute('rx', 1);
                stamFill.setAttribute('fill', '#22C55E');
                playerG.appendChild(stamFill);

                this.svg.appendChild(playerG);
                this.playerVisuals[playerId] = {
                    element: playerG, x: coords.x, y: coords.y, pitchX: x, pitchY: y,
                    staminaFill: stamFill, staminaWidth: STAM_W,
                };
                return playerG;
            }

            // Live-update a player's stamina bar (called from updateStats each tick).
            updateStamina(playerId, stamina) {
                const v = this.playerVisuals[playerId];
                if (!v || !v.staminaFill) return;
                const pct = Math.max(0, Math.min(100, stamina));
                v.staminaFill.setAttribute('width', (v.staminaWidth * pct / 100).toFixed(2));
                v.staminaFill.setAttribute('fill',
                    pct < 30 ? '#EF4444' :  // red
                    pct < 60 ? '#FACC15' :  // yellow
                               '#22C55E');  // green
            }

            renderBall(x, y) {
                if (this.ballElement) this.ballElement.remove();
                const coords = this.getPixelCoords(x, y);
                this.ballElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                this.ballElement.setAttribute('cx', coords.x);
                this.ballElement.setAttribute('cy', coords.y);
                this.ballElement.setAttribute('r', '5');
                this.ballElement.setAttribute('fill', '#fff');
                this.ballElement.setAttribute('stroke', '#000');
                this.ballElement.setAttribute('stroke-width', '0.5');
                this.svg.appendChild(this.ballElement);
            }

            updatePlayerPosition(playerId, x, y) {
                const visual = this.playerVisuals[playerId];
                if (!visual) return;
                const coords = this.getPixelCoords(x, y);
                visual.element.setAttribute('transform', `translate(${coords.x - visual.x}, ${coords.y - visual.y})`);
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
            static seededRandom(seed) {
                return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
            }

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

            static createSVG(avatar, size = 100, jerseyOverride = null) {
                if (!AvatarGenerator._n) AvatarGenerator._n = 0;
                const uid = 'av' + (++AvatarGenerator._n);
                const sk  = avatar.skin;
                const skD = this.shade(sk, -20);   // shadow
                const skL = this.shade(sk,  18);   // highlight
                const jer = jerseyOverride || avatar.jersey;
                const jerD = this.shade(jer, -28);
                const jerL = this.shade(jer,  22);

                // Build drives shoulder width
                const bw = avatar.build === 'slim' ? 36 : avatar.build === 'stocky' ? 50 : 43;
                const bx = 50 - bw / 2;

                // Head geometry  (portrait-style: head fills top 60%)
                const hcx = 50, hcy = 37, hrx = 17, hry = 21;
                const topY = hcy - hry;   // = 16

                let s = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">`;

                // ── Defs ──────────────────────────────────────────────────
                s += `<defs>
  <linearGradient id="bg${uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#cce8f8"/>
    <stop offset="55%"  stop-color="#9ecae8"/>
    <stop offset="100%" stop-color="#6ea8d0"/>
  </linearGradient>
  <linearGradient id="hd${uid}" x1="0.25" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="${skL}"/>
    <stop offset="100%" stop-color="${skD}"/>
  </linearGradient>
  <linearGradient id="jr${uid}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="${jerD}"/>
    <stop offset="25%"  stop-color="${jer}"/>
    <stop offset="75%"  stop-color="${jer}"/>
    <stop offset="100%" stop-color="${jerD}"/>
  </linearGradient>
  <linearGradient id="jrv${uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="${jerL}" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="${jerD}" stop-opacity="0.3"/>
  </linearGradient>
</defs>`;

                // ── Background ────────────────────────────────────────────
                s += `<rect width="100" height="100" fill="url(#bg${uid})" rx="8"/>`;
                // subtle pitch lines
                s += `<line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"/>`;
                s += `<ellipse cx="50" cy="100" rx="40" ry="12" fill="rgba(0,0,0,0.12)"/>`;

                // ── Arms (behind body) ────────────────────────────────────
                s += `<path d="M${bx+4},65 L${bx-13},72 L${bx-14},94 L${bx+4},90 Z" fill="url(#jr${uid})"/>`;
                s += `<path d="M${bx+bw-4},65 L${bx+bw+13},72 L${bx+bw+14},94 L${bx+bw-4},90 Z" fill="url(#jr${uid})"/>`;
                // wrist/hand
                s += `<ellipse cx="${bx-11}" cy="95" rx="4.5" ry="3" fill="${sk}" opacity="0.9"/>`;
                s += `<ellipse cx="${bx+bw+11}" cy="95" rx="4.5" ry="3" fill="${sk}" opacity="0.9"/>`;

                // ── Jersey body ───────────────────────────────────────────
                s += `<path d="M${bx},63 Q50,60 ${bx+bw},63 L${bx+bw+5},100 L${bx-5},100 Z" fill="url(#jr${uid})"/>`;
                s += `<path d="M${bx},63 Q50,60 ${bx+bw},63 L${bx+bw+5},100 L${bx-5},100 Z" fill="url(#jrv${uid})"/>`;
                // side shadow strips
                s += `<path d="M${bx},63 L${bx+7},63 L${bx+3},100 L${bx-5},100 Z" fill="rgba(0,0,0,0.08)"/>`;
                s += `<path d="M${bx+bw},63 L${bx+bw-7},63 L${bx+bw-3},100 L${bx+bw+5},100 Z" fill="rgba(0,0,0,0.08)"/>`;

                // V-collar
                s += `<polygon points="${50-8},63 50,73 ${50+8},63" fill="${jerD}"/>`;
                s += `<polygon points="${50-6},63 50,71 ${50+6},63" fill="${sk}" opacity="0.15"/>`;

                // shoulder seam highlights
                s += `<path d="M${bx},63 Q${bx+5},61 ${bx+14},63" stroke="${jerL}" fill="none" stroke-width="1.2" opacity="0.55"/>`;
                s += `<path d="M${bx+bw},63 Q${bx+bw-5},61 ${bx+bw-14},63" stroke="${jerL}" fill="none" stroke-width="1.2" opacity="0.55"/>`;

                // ── Neck ──────────────────────────────────────────────────
                s += `<path d="M45,55 Q50,53 55,55 L55.5,63 Q50,61 44.5,63 Z" fill="${sk}"/>`;
                s += `<path d="M45,55 Q47,53 50,54 L50,63 Q47,62 44.5,63 Z" fill="rgba(0,0,0,0.07)"/>`;

                // ── Ears (drawn before head so head overlaps inner ear) ───
                s += `<ellipse cx="${hcx-hrx+1}" cy="${hcy+4}" rx="4" ry="5" fill="${sk}"/>`;
                s += `<ellipse cx="${hcx+hrx-1}" cy="${hcy+4}" rx="4" ry="5" fill="${sk}"/>`;
                s += `<ellipse cx="${hcx-hrx+1}" cy="${hcy+4}" rx="2.2" ry="3" fill="${skD}" opacity="0.35"/>`;
                s += `<ellipse cx="${hcx+hrx-1}" cy="${hcy+4}" rx="2.2" ry="3" fill="${skD}" opacity="0.35"/>`;

                // ── Head ──────────────────────────────────────────────────
                s += `<ellipse cx="${hcx}" cy="${hcy}" rx="${hrx}" ry="${hry}" fill="url(#hd${uid})"/>`;
                // subtle jaw shadow
                s += `<ellipse cx="${hcx}" cy="${hcy+13}" rx="12" ry="6" fill="${skD}" opacity="0.18"/>`;
                // forehead highlight
                s += `<ellipse cx="${hcx-4}" cy="${topY+6}" rx="7" ry="4.5" fill="${skL}" opacity="0.3"/>`;
                // cheek blush
                s += `<ellipse cx="${hcx-10}" cy="${hcy+7}" rx="5" ry="3.5" fill="rgba(230,100,80,0.15)"/>`;
                s += `<ellipse cx="${hcx+10}" cy="${hcy+7}" rx="5" ry="3.5" fill="rgba(230,100,80,0.15)"/>`;

                // ── Hair ──────────────────────────────────────────────────
                s += this.drawHair(avatar, hcx, hcy, hrx, hry);

                // ── Eyebrows ──────────────────────────────────────────────
                const browC = (avatar.hair === '#DAA520' || avatar.hair === '#C19A6B') ? '#7a5800' : this.shade(avatar.hair, -10);
                const browY = hcy - 9;
                if (avatar.expr === 2) {
                    s += `<path d="M41,${browY+1} Q44.5,${browY-2} 48,${browY+0.5}" stroke="${browC}" fill="none" stroke-width="1.5" stroke-linecap="round"/>`;
                    s += `<path d="M52,${browY+0.5} Q55.5,${browY-2} 59,${browY+1}" stroke="${browC}" fill="none" stroke-width="1.5" stroke-linecap="round"/>`;
                } else {
                    s += `<path d="M41,${browY} Q44.5,${browY-2.5} 48,${browY}" stroke="${browC}" fill="none" stroke-width="1.5" stroke-linecap="round"/>`;
                    s += `<path d="M52,${browY} Q55.5,${browY-2.5} 59,${browY}" stroke="${browC}" fill="none" stroke-width="1.5" stroke-linecap="round"/>`;
                }

                // ── Eyes ──────────────────────────────────────────────────
                const ey = hcy - 3;
                // left eye
                s += `<ellipse cx="43" cy="${ey}" rx="4.2" ry="3.4" fill="white"/>`;
                s += `<circle  cx="43" cy="${ey}" r="2.7" fill="${avatar.eyes}"/>`;
                s += `<circle  cx="43" cy="${ey}" r="1.6" fill="#0d0d0d"/>`;
                s += `<circle  cx="44.4" cy="${ey-1.1}" r="0.9" fill="white"/>`;
                s += `<path d="M38.8,${ey-2.8} Q43,${ey-5} 47.2,${ey-2.8}" stroke="${skD}" fill="none" stroke-width="0.8" opacity="0.6"/>`;
                // right eye
                s += `<ellipse cx="57" cy="${ey}" rx="4.2" ry="3.4" fill="white"/>`;
                s += `<circle  cx="57" cy="${ey}" r="2.7" fill="${avatar.eyes}"/>`;
                s += `<circle  cx="57" cy="${ey}" r="1.6" fill="#0d0d0d"/>`;
                s += `<circle  cx="58.4" cy="${ey-1.1}" r="0.9" fill="white"/>`;
                s += `<path d="M52.8,${ey-2.8} Q57,${ey-5} 61.2,${ey-2.8}" stroke="${skD}" fill="none" stroke-width="0.8" opacity="0.6"/>`;

                // ── Nose ──────────────────────────────────────────────────
                const ny = hcy + 7;
                s += `<path d="M50,${ny-5} C50,${ny-2} 47.5,${ny+1} 47,${ny+2} M50,${ny-5} C50,${ny-2} 52.5,${ny+1} 53,${ny+2}" stroke="${skD}" fill="none" stroke-width="0.85" opacity="0.5" stroke-linecap="round"/>`;
                s += `<path d="M47,${ny+2} Q50,${ny+3.5} 53,${ny+2}" stroke="${skD}" fill="none" stroke-width="0.75" opacity="0.45"/>`;

                // ── Mouth ─────────────────────────────────────────────────
                const my = hcy + 14;
                const lipC = this.shade(sk, -38);
                if (avatar.expr === 0) {
                    // wide smile
                    s += `<path d="M44,${my} Q50,${my+6} 56,${my}" stroke="${lipC}" fill="none" stroke-width="1.2" stroke-linecap="round"/>`;
                    s += `<path d="M44.5,${my+0.5} Q50,${my+5.5} 55.5,${my+0.5}" fill="rgba(160,40,40,0.3)"/>`;
                    s += `<path d="M45.5,${my+1} Q50,${my+3.5} 54.5,${my+1}" fill="rgba(255,255,255,0.35)"/>`;
                } else if (avatar.expr === 1) {
                    // relaxed/neutral
                    s += `<path d="M44,${my+2} Q50,${my+4} 56,${my+2}" stroke="${lipC}" fill="none" stroke-width="1.1" stroke-linecap="round"/>`;
                    s += `<path d="M44.5,${my+2} Q50,${my+3.5} 55.5,${my+2}" fill="rgba(160,40,40,0.2)"/>`;
                } else {
                    // stern/focused
                    s += `<path d="M44,${my+3.5} Q50,${my+2} 56,${my+3.5}" stroke="${lipC}" fill="none" stroke-width="1.1" stroke-linecap="round"/>`;
                }

                // ── Beard / stubble ───────────────────────────────────────
                if (avatar.hasBeard) {
                    const bc = avatar.beardColor;
                    s += `<path d="M35,${hcy+11} Q50,${hcy+25} 65,${hcy+11} Q63,${hcy+20} 50,${hcy+24} Q37,${hcy+20} 35,${hcy+11} Z" fill="${bc}" opacity="0.20"/>`;
                    s += `<path d="M37,${hcy+9} Q50,${hcy+22} 63,${hcy+9} Q61,${hcy+17} 50,${hcy+21} Q39,${hcy+17} 37,${hcy+9} Z" fill="${bc}" opacity="0.12"/>`;
                    // mustache
                    s += `<path d="M45.5,${my-1} Q50,${my+1} 54.5,${my-1}" stroke="${bc}" fill="none" stroke-width="1.1" opacity="0.35"/>`;
                }

                s += `</svg>`;
                return s;
            }

            static drawHair(avatar, cx, cy, rx, ry) {
                const hair = avatar.hair;
                const hL   = this.shade(hair, 20);
                const topY = cy - ry;    // top of head ellipse
                let h = '';

                switch (avatar.hairStyle) {
                    case 'short': {
                        // tight cap following head curve
                        h += `<path d="M${cx-rx},${cy-5} Q${cx-rx+2},${topY-3} ${cx},${topY-4} Q${cx+rx-2},${topY-3} ${cx+rx},${cy-5} Q${cx+rx},${cy-14} ${cx},${topY-5} Q${cx-rx},${cy-14} ${cx-rx},${cy-5} Z" fill="${hair}"/>`;
                        h += `<ellipse cx="${cx-2}" cy="${topY+3}" rx="6" ry="3.5" fill="${hL}" opacity="0.3"/>`;
                        break;
                    }
                    case 'curly': {
                        // thick curly mass
                        h += `<ellipse cx="${cx}" cy="${topY+7}" rx="${rx+4}" ry="14" fill="${hair}"/>`;
                        const pts = [[0,-1],[1,0],[2,1],[3,0],[4,-1],[5,0],[6,1],[7,0],[8,-1],[9,0],[10,1],[11,0]];
                        for (let i = 0; i < 13; i++) {
                            const a = (i/13)*Math.PI*2;
                            const r2 = rx + 3 + Math.sin(i*2.3)*1.5;
                            const px = cx + Math.cos(a)*r2, py = cy-10 + Math.sin(a)*10;
                            h += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.8" fill="${hair}"/>`;
                        }
                        h += `<ellipse cx="${cx-3}" cy="${topY}" rx="5" ry="3" fill="${hL}" opacity="0.22"/>`;
                        break;
                    }
                    case 'spiky': {
                        // base + sharp distinct spikes
                        h += `<ellipse cx="${cx}" cy="${topY+7}" rx="${rx}" ry="9" fill="${hair}"/>`;
                        const spikes = [[-9,13],[-5,18],[-1,21],[3,19],[7,15],[11,10]];
                        spikes.forEach(([ox,ht]) => {
                            const base = topY + 6;
                            h += `<polygon points="${cx+ox-3},${base} ${cx+ox+1},${base-ht} ${cx+ox+4},${base}" fill="${hair}"/>`;
                        });
                        h += `<ellipse cx="${cx+1}" cy="${topY+2}" rx="4" ry="2.5" fill="${hL}" opacity="0.28"/>`;
                        break;
                    }
                    case 'slicked': {
                        // side-parted, swept right
                        h += `<path d="M${cx-rx},${cy-6}
                            Q${cx-rx+2},${topY-2} ${cx-4},${topY-3}
                            Q${cx+rx-4},${topY-2} ${cx+rx},${cy-4}
                            L${cx+rx-1},${cy-1}
                            Q${cx+rx-4},${topY+3} ${cx-1},${topY+1}
                            Q${cx-rx+3},${topY+3} ${cx-rx},${cy-4} Z" fill="${hair}"/>`;
                        // part line + sheen
                        h += `<path d="M${cx-3},${cy-7} Q${cx-1},${topY-1} ${cx+6},${topY+1}" stroke="${hL}" fill="none" stroke-width="1.4" opacity="0.35" stroke-linecap="round"/>`;
                        break;
                    }
                    case 'wavy': {
                        h += `<path d="M${cx-rx},${cy-5}
                            Q${cx-rx+1},${topY-1} ${cx-8},${topY-5}
                            Q${cx},${topY-8} ${cx+8},${topY-5}
                            Q${cx+rx-1},${topY-1} ${cx+rx},${cy-5}
                            L${cx+rx},${cy-2}
                            Q${cx+rx-2},${topY+2} ${cx+6},${topY-2}
                            Q${cx},${topY-5} ${cx-6},${topY-2}
                            Q${cx-rx+2},${topY+2} ${cx-rx},${cy-2} Z" fill="${hair}"/>`;
                        h += `<path d="M${cx-10},${cy-8} Q${cx-5},${topY-3} ${cx+2},${topY-5}" stroke="${hL}" fill="none" stroke-width="1.5" opacity="0.3" stroke-linecap="round"/>`;
                        break;
                    }
                    case 'mohawk': {
                        // shaved sides — just central strip
                        h += `<path d="M${cx-4},${cy-12}
                            Q${cx-3},${topY-8} ${cx},${topY-12}
                            Q${cx+3},${topY-8} ${cx+4},${cy-12}
                            L${cx+3},${cy-4} Q${cx},${cy-2} ${cx-3},${cy-4} Z" fill="${hair}"/>`;
                        // texture lines
                        for (let i=0;i<5;i++) {
                            const py = cy-12+i*2.5;
                            h += `<line x1="${cx-2.5}" y1="${py}" x2="${cx+2.5}" y2="${py-3}" stroke="${hL}" stroke-width="0.7" opacity="0.4"/>`;
                        }
                        break;
                    }
                    case 'afro': {
                        h += `<ellipse cx="${cx}" cy="${topY+5}" rx="${rx+6}" ry="20" fill="${hair}"/>`;
                        for (let i=0;i<16;i++) {
                            const a=(i/16)*Math.PI*2;
                            const r2 = rx+5+Math.sin(i*1.9)*2.5;
                            const px=cx+Math.cos(a)*r2, py=topY+5+Math.sin(a)*17;
                            h += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.2" fill="${hair}"/>`;
                        }
                        h += `<ellipse cx="${cx-5}" cy="${topY-4}" rx="6" ry="4" fill="${hL}" opacity="0.2"/>`;
                        break;
                    }
                    case 'bald':
                    default: {
                        // very faint stubble hint
                        h += `<ellipse cx="${cx}" cy="${topY+7}" rx="${rx}" ry="9" fill="${hair}" opacity="0.09"/>`;
                        break;
                    }
                }
                return h;
            }
        }

        class CrestGenerator {
            static _rng(seed) {
                return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
            }

            static _lum(hex) {
                const n = parseInt(hex.replace('#',''), 16);
                return ((n>>16)&255)*0.299 + ((n>>8)&255)*0.587 + (n&255)*0.114;
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
                let s = `<svg width="${size}" height="${h}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">`;
                s += `<defs><clipPath id="${uid}"><path d="${shield}"/></clipPath></defs>`;
                s += `<path d="${shield}" fill="rgba(0,0,0,0.22)" transform="translate(2,3)"/>`;
                s += `<path d="${shield}" fill="${primaryColor}"/>`;
                s += `<g clip-path="url(#${uid})">`;
                if (design==='halves')   s += `<rect x="50" y="0" width="50" height="120" fill="${sec}" opacity="0.85"/>`;
                else if (design==='quarters') { s += `<rect x="50" y="0" width="50" height="62" fill="${sec}" opacity="0.85"/>`; s += `<rect x="0" y="62" width="50" height="58" fill="${sec}" opacity="0.85"/>`; }
                else if (design==='stripes')  { s += `<rect x="20" y="0" width="20" height="120" fill="${sec}" opacity="0.85"/>`; s += `<rect x="60" y="0" width="20" height="120" fill="${sec}" opacity="0.85"/>`; }
                else if (design==='chevron')   s += `<polygon points="0,52 50,88 100,52 100,72 50,108 0,72" fill="${sec}" opacity="0.85"/>`;
                else if (design==='diagonal')  s += `<polygon points="0,0 65,0 100,50 100,120 35,120 0,70" fill="${sec}" opacity="0.72"/>`;
                else if (design==='cross')    { s += `<rect x="40" y="0" width="20" height="120" fill="${sec}" opacity="0.8"/>`; s += `<rect x="0" y="44" width="100" height="22" fill="${sec}" opacity="0.8"/>`; }
                s += `</g>`;
                s += `<path d="${inner}"  fill="none" stroke="${acc}" stroke-width="1.5" opacity="0.65"/>`;
                s += `<path d="${shield}" fill="none" stroke="${acc}" stroke-width="3"/>`;
                s += `<text x="50" y="30" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="${acc}">★</text>`;
                const fs = initials.length <= 2 ? 27 : 20;
                s += `<text x="50" y="77" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${fs}" fill="${acc}" stroke="rgba(0,0,0,0.55)" stroke-width="2" paint-order="stroke">${initials}</text>`;
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
            // CM 01/02-style individual player instructions, sensible defaults by position.
            static defaultInstructions(position) {
                const inst = {
                    forwardRuns:  'mixed',   // often | mixed | rarely
                    runWithBall:  'mixed',   // often | mixed | rarely
                    longShots:    'mixed',   // often | mixed | rarely
                    throughBalls: 'mixed',   // often | mixed | rarely
                    holdUpBall:   'no',      // yes | no
                    freeRole:     'no',      // yes | no
                    arrow:        null,      // null | 'forward' | 'back' | 'left' | 'right' | 'forward-left' | 'forward-right' | 'back-left' | 'back-right'
                };
                if (['ST','CF'].includes(position)) {
                    inst.forwardRuns = 'often'; inst.holdUpBall = 'yes'; inst.longShots = 'often';
                } else if (['LW','RW'].includes(position)) {
                    inst.forwardRuns = 'often'; inst.runWithBall = 'often';
                } else if (position === 'CAM') {
                    inst.forwardRuns = 'often'; inst.runWithBall = 'often'; inst.throughBalls = 'often';
                } else if (['LM','RM','LWB','RWB'].includes(position)) {
                    inst.runWithBall = 'often';
                } else if (position === 'CM') {
                    inst.throughBalls = 'often';
                } else if (['CB','CDM','LB','RB'].includes(position)) {
                    inst.forwardRuns = 'rarely'; inst.runWithBall = 'rarely'; inst.longShots = 'rarely';
                } else if (position === 'GK') {
                    inst.forwardRuns = 'rarely'; inst.runWithBall = 'rarely'; inst.longShots = 'rarely';
                }
                return inst;
            }

            constructor(teamName, excludedColor = null) {
                this.teamName = teamName;
                const jerseyColors = ['#FF0000', '#0000FF', '#FFFF00', '#FF6600', '#FF00FF', '#00FFFF', '#FF4444'];
                const available = excludedColor ? jerseyColors.filter(c => c !== excludedColor) : jerseyColors;
                this.jerseyColor = available[Math.floor(Math.random() * available.length)];
                const crestSeed = Math.floor(Math.random() * 99999);
                this.clubName   = CrestGenerator.generateName(crestSeed);
                this.crestSVG   = CrestGenerator.generateSVG(crestSeed, this.jerseyColor, 70);
                this.crestSVGSm = CrestGenerator.generateSVG(crestSeed, this.jerseyColor, 44);
                this.players = this.generatePlayers();
                this.startingXI = [];
                this.bench = [];
                this.onField = [];
            }

            generatePlayers() {
                const outfieldPositions = ['CB', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST', 'CAM', 'CDM', 'LW', 'RW', 'CF', 'LWB', 'RWB'];
                const players = [];
                const count = 20 + Math.floor(Math.random() * 6);

                for (let i = 0; i < count; i++) {
                    // first 2 players are always GKs so we always have a starter + backup
                    const position = i < 2 ? 'GK' : outfieldPositions[Math.floor(Math.random() * outfieldPositions.length)];
                    const nation = pickNation();
                    const first = nation.first[Math.floor(Math.random() * nation.first.length)];
                    const last  = nation.last[Math.floor(Math.random() * nation.last.length)];
                    const name  = nation.format === 'last_first' ? `${last} ${first}` : `${first} ${last}`;
                    const attributes = this.generateAttributes(position, i);

                    players.push({
                        id: i,
                        name,
                        flag: nation.flag,
                        nationality: nation.name,
                        position,
                        number: i + 1,
                        appearances: 0,
                        goals: 0,
                        assists: 0,
                        isOnField: false,
                        avatar: AvatarGenerator.generateAvatar(i, this.jerseyColor),
                        instructions: Team.defaultInstructions(position),
                        ...attributes
                    });
                }

                if (this.teamName === 'You') {
                    players[6] = {
                        ...players[6],
                        name: 'Nguyễn Thế Chí Vỹ',
                        flag: '🇻🇳',
                        nationality: 'Vietnamese',
                        position: 'ST',
                        // CM 03/04-style attributes
                        pace: 89, stamina: 88, strength: 87,
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
                    };
                }

                return players;
            }

            generateAttributes(position, seed) {
                const rng = AvatarGenerator.seededRandom(seed);
                const r = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

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

                const profile = P[position] || P.CM;
                const attrs = {};
                for (const [key, [lo, hi]] of Object.entries(profile)) {
                    attrs[key] = r(lo, hi);
                }

                // Position-weighted overall rating for squad selection sorting
                attrs.overall = Math.round(this.computeOverall(position, attrs));

                // Backward-compatible aliases used by display and legacy logic
                attrs.shooting  = attrs.finishing;
                attrs.speed     = attrs.pace;
                attrs.offensive = attrs.offTheBall;
                attrs.defensive = attrs.positioning;
                attrs.heading   = attrs.heading;   // already set

                attrs.influence = r(55, 99);
                attrs.luck      = r(0, 99);

                return attrs;
            }

            computeOverall(position, attrs) {
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
                    playerShots: 0,
                    cpuShots: 0,
                    playerTackles: 0,
                    cpuTackles: 0,
                    playerPasses: 0,
                    cpuPasses: 0,
                    playerPossession: 50,
                    cpuPossession: 50
                };
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                this.goals = [];
                this.substitutions = [];
                this.cardData = { player: [], cpu: [] };
                this.teamInstruction = 'neutral'; // kept for legacy compat
                this.tactics = { mentality: 'normal', closingDown: 'standard', tackling: 'normal', passing: 'mixed' };
                this.momentum = 50; // 0=CPU dominates, 100=player dominates
                this._attackPhase = null; // null | 'buildup' | 'progression' | 'danger'
                this._attackTeam  = null; // 'player' | 'cpu'
                this._phaseTicks  = 0;
                this.matchSpeed   = 'fast';   // 'slow' | 'normal' | 'fast' — 'fast' preserves legacy 500ms/1000ms pace
                this._cpuLastFormationChangeMinute = 0;  // CPU AI cooldown tracker
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
                this.playerTeam = new Team('You');
                this.playerTeam.setupSquad(this.playerFormation);
                console.log('Setting up event listeners...');
                this.setupEventListeners();
                console.log('FootballSimulator constructor complete');
            }

            setupEventListeners() {
                try {
                    console.log('setupEventListeners: Starting');
                    const formationBtns = document.querySelectorAll('.formation-btn');
                    console.log('setupEventListeners: Found ' + formationBtns.length + ' formation buttons');
                    formationBtns.forEach((btn, idx) => {
                        console.log('setupEventListeners: Adding listener to button ' + idx + ', formation: ' + btn.dataset.formation);
                        btn.addEventListener('click', (e) => {
                            console.log('Formation button clicked, formation: ' + btn.dataset.formation);
                            this.selectFormation(btn);
                        });
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

                    // Triple-click on the match clock toggles debug mode (zone-rating overlay).
                    const timerEl = document.getElementById('timer');
                    if (timerEl) timerEl.addEventListener('click', () => this._registerTimerClick());

                    const manageBtn = document.getElementById('manageBtn');
                    if (manageBtn) manageBtn.addEventListener('click', () => this.openManagement());

                    const closeManageBtn = document.getElementById('closeManageBtn');
                    if (closeManageBtn) closeManageBtn.addEventListener('click', () => this.closeManagement());

                    const playAgainBtn = document.getElementById('playAgainBtn');
                    if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.reset());

                    document.querySelectorAll('.tactic-btn').forEach(btn => {
                        btn.addEventListener('click', () => this.setTactic(btn.dataset.tactic, btn.dataset.value));
                    });

                    document.querySelectorAll('.speed-btn').forEach(btn => {
                        btn.addEventListener('click', () => this.setMatchSpeed(btn.dataset.speed));
                    });

                    // Render management panel now that team is initialized
                    this.renderManagementPanel();
                } catch (error) {
                    console.error('Error setting up event listeners:', error);
                }
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
                const overlay = document.getElementById('playerDetailOverlay');
                const content = document.getElementById('playerDetailOverlayContent');
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
                            <div class="player-detail-position">${player.nationality ? player.nationality + ' · ' : ''}${player.position} <span style="font-size:1.1em;font-weight:bold;color:${ovrColor};">${ovr}</span></div>
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
                    console.log('selectFormation called with:', btn);
                    console.log('btn type:', typeof btn);
                    console.log('btn.dataset:', btn?.dataset);

                    if (!btn) {
                        console.error('No button provided to selectFormation');
                        return;
                    }

                    const formation = btn.dataset.formation;
                    console.log('Formation from button:', formation);

                    if (!formation) {
                        console.error('No data-formation attribute found on button');
                        return;
                    }

                    // Remove selected from all buttons
                    const allBtns = document.querySelectorAll('.formation-btn');
                    console.log('Found', allBtns.length, 'formation buttons to update');
                    allBtns.forEach(b => {
                        b.classList.remove('selected');
                        console.log('Removed selected from button:', b.dataset.formation);
                    });

                    // Add selected to clicked button
                    console.log('Adding selected class to button with formation:', formation);
                    btn.classList.add('selected');
                    console.log('Button classes after add:', btn.className);

                    // Save formation
                    this.playerFormation = formation;
                    console.log('Saved playerFormation:', this.playerFormation);

                    // Enable start button (old formation screen)
                    const startBtn = document.getElementById('startBtn');
                    if (startBtn) startBtn.disabled = false;

                    // In pre-match mode, re-setup squad with new formation and refresh panel
                    if (this.isPreMatch && this.playerTeam) {
                        this.playerTeam.setupSquad(formation);
                        this.renderManagementPanel();
                    }
                } catch (error) {
                    console.error('Error in selectFormation:', error);
                    console.error('Error stack:', error.stack);
                }
            }

            startMatch() {
                try {
                    console.log('startMatch called');
                    this.isPreMatch = false;
                    this.rules.reset();
                    this.cpuFormation = this.getRandomFormation();
                    console.log('CPU formation:', this.cpuFormation);

                    console.log('Creating CPU team...');
                    // playerTeam already set up via management panel
                    this.cpuTeam = new Team('CPU', this.playerTeam.jerseyColor);
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

                    this.isRunning = true;
                    console.log('Starting match...');
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

            generateEvent() {
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

                // Visual: show the ball changing hands
                if (this.matchFlow) this.matchFlow.onEvent('possession', { team: possession });

                this._attackTeam = possession;
                this._phaseTicks = 0;

                // Gung-ho / direct teams launch immediately, skipping patient buildup
                const skipChance = possession === 'player'
                    ? ({ 'gung-ho': 0.40, 'attacking': 0.20, 'normal': 0, 'defensive': 0, 'ultra-def': 0 }[this.tactics.mentality] || 0)
                      + ({ 'direct': 0.20, 'mixed': 0, 'short': 0 }[this.tactics.passing] || 0)
                    : 0;

                this._attackPhase = Math.random() < skipChance ? 'progression' : 'buildup';
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
                const turnoverChance = (defZones.midfield / 100) * pressMod * 0.18;

                if (Math.random() < turnoverChance) {
                    // Sometimes a defensive header wins the duel instead of a tackle
                    if (Math.random() < 0.30) this.headerEvent(opp, false);
                    else                     this.tackleEvent(opp);
                    this._attackTeam  = opp;
                    this._attackPhase = 'buildup';
                    this._phaseTicks  = 0;
                    return;
                }

                // Ball briefly out of play — team retains via throw-in, slight delay
                if (Math.random() < 0.06) {
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
                    this.passEvent(team);        // final ball over the top / into midfield
                    this._attackPhase = 'progression';
                    this._phaseTicks  = 0;
                } else {
                    this.passEvent(team);        // safe pass, staying in own half
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
                        // Defense clears — ball goes out for a corner
                        this.cornerEvent(team);
                        this._attackPhase = null;
                        this._attackTeam  = null;
                        this._phaseTicks  = 0;
                    }
                    return;
                }

                // Speculative long shot from outside the box — ends the attack.
                // Probability scales with how many onfield mids have longShots: often.
                const teamObjLS = team === 'player' ? this.playerTeam : this.cpuTeam;
                const oftenShooters = teamObjLS?.onField?.filter(p =>
                    ['CM','CAM','CDM','LM','RM'].includes(p.position) && p.instructions?.longShots === 'often'
                ).length || 0;
                const lsProb = Math.min(0.20, 0.06 + oftenShooters * 0.035);
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
                    if (Math.random() < tbProb) this.throughBallEvent(team);
                    else                        this.passEvent(team);
                    this._attackPhase = 'danger';
                    this._phaseTicks  = 0;
                } else {
                    this.passEvent(team);        // patient build-up in the final third
                }
            }

            // ── Danger phase: shot situation — always ends the attack sequence ────────
            _doDanger() {
                const team = this._attackTeam;
                const opp  = team === 'player' ? 'cpu' : 'player';

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

                // Rare specials inside the danger phase — short-circuit the normal table
                if (Math.random() < 0.04) { this.penaltyEvent(team);         return; }
                if (Math.random() < 0.05) { this.freeKickEvent(team);        return; }
                if (Math.random() < 0.06 && attackScore > 0.50) { this.oneOnOneEvent(team);   return; }
                if (Math.random() < 0.05)                       { this.headerEvent(team, true); return; }
                if (Math.random() < 0.04)                       { this.goalmouthScrambleEvent(team); return; }
                if (Math.random() < 0.015 && attackScore > 0.55) { this.spectacularEvent(team); return; }
                if (Math.random() < 0.012)                      { this.ownGoalEvent(team);    return; }
                if (Math.random() < 0.020)                      { this.goalDisallowedEvent(team); return; }

                if (attackScore > 0.62) {
                    if (r2 < 0.28)       this.goalEvent(team);
                    else if (r2 < 0.55)  this.chanceEvent(team);
                    else if (r2 < 0.68)  this.missedChanceEvent(team);
                    else if (r2 < 0.78)  this.barEvent(team);
                    else if (r2 < 0.86)  this.cornerEvent(team);
                    else                 this.saveEvent();
                } else if (attackScore > 0.48) {
                    if (r2 < 0.12)       this.goalEvent(team);
                    else if (r2 < 0.32)  this.chanceEvent(team);
                    else if (r2 < 0.50)  this.missedChanceEvent(team);
                    else if (r2 < 0.64)  this.saveEvent();
                    else if (r2 < 0.76)  this.barEvent(team);
                    else if (r2 < 0.88)  this.cornerEvent(team);
                    else                 this.tackleEvent(opp);
                } else {
                    if (r2 < 0.05)       this.goalEvent(team);
                    else if (r2 < 0.16)  this.chanceEvent(team);
                    else if (r2 < 0.38)  this.saveEvent();
                    else if (r2 < 0.58)  this.missedChanceEvent(team);
                    else if (r2 < 0.72)  this.cornerEvent(team);
                    else                 this.tackleEvent(opp);
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
                this.goals.push({ team, scorer: scorer.name, assister: assist?.name ?? null, time: `${minute}'` });

                const scorerId = team === 'player'
                    ? this.playerTeam.onField.indexOf(scorer)
                    : this.cpuTeam.onField.indexOf(scorer) + 100;
                const teamId = team === 'player' ? 1 : 2;

                if (team === 'player') {
                    this.playerScore++;
                    this.stats.playerShots++;
                    this.momentum = Math.min(100, this.momentum + 20);
                } else {
                    this.cpuScore++;
                    this.stats.cpuShots++;
                    this.momentum = Math.max(0, this.momentum - 15);
                }
                const assistText = assist ? ` (assist: <b class="ev-name">${assist.name}</b>)` : '';
                this.addEvent(`⚽ GOAL (${minute}')! <b class="ev-name">${scorer.name}</b> scores!${assistText}`, 'goal', team);

                if (this.matchFlow) this.matchFlow.onEvent('goal', { scorer: scorerId, team });
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
                this.addEvent(`🎯 ${quality} chance for <b class="ev-name">${player.name}</b>!`, 'chance', team);
                if (this.matchFlow) this.matchFlow.onEvent('chance', { team });
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

                // Tackling setting: hard = more success but more fouls; easy = fewer fouls, fewer wins
                const tacklingStyle = this.tactics.tackling || 'normal';
                const tackleBoost  = tacklingStyle === 'hard' ? 0.08 : tacklingStyle === 'easy' ? -0.08 : 0;
                const adjustedSuccess = Math.min(0.92, tackleSuccess + tackleBoost);
                const foulRate     = tacklingStyle === 'hard' ? 0.55 : tacklingStyle === 'easy' ? 0.20 : 0.40;

                if (Math.random() > adjustedSuccess) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    // player tackling style sets foul rate; CPU always uses base 40%
                    const effectiveFoulRate = team === 'player' ? foulRate : 0.40;
                    if (Math.random() < effectiveFoulRate) {
                        this.addEvent(`🟡 Foul by <b class="ev-name">${defender.name}</b> (${minute}')! Free kick awarded.`, 'tackle', team);
                        const foulX = attTeam === 'player'
                            ? 30 + Math.random() * 40
                            : 30 + Math.random() * 40;
                        const foulY = 25 + Math.random() * 50;
                        if (this.matchFlow) this.matchFlow.onEvent('freekick', { team: attTeam, x: foulX, y: foulY });
                        if (Math.random() < 0.20) this.cardEvent(team); // possible booking
                    } else {
                        this.addEvent(`🛡️ <b class="ev-name">${defender.name}</b> misses the tackle!`, 'tackle', team);
                    }
                    return;
                }

                if (team === 'player') {
                    this.stats.playerTackles++;
                    this.momentum = Math.min(100, this.momentum + 3);
                    this.addEvent(`🛡️ <b class="ev-name">${defender.name}</b> wins the ball!`, 'tackle', team);
                } else {
                    this.stats.cpuTackles++;
                    this.momentum = Math.max(0, this.momentum - 3);
                    this.addEvent(`🛡️ <b class="ev-name">${defender.name}</b> dispossesses the attacker!`, 'tackle', team);
                }
                if (this.matchFlow) this.matchFlow.onEvent('tackle', { team });

                // Stamina drain from tackle (determination softens it)
                const detMod = (defender.determination || 70) / 100;
                defender.stamina = Math.max(10, defender.stamina - (3 * (1 - detMod * 0.4)));
            }

            passEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const passer = teamObj.getRandomPlayer(true);
                const receiver = teamObj.getRandomPlayer(true);

                // Pass quality from vision/creativity/passing
                const passSkill = ((passer.passing || 70) * 0.45 + (passer.vision || 60) * 0.30 + (passer.creativity || 60) * 0.25) / 100;
                const staminaFactor = (passer.stamina || 70) / 100;
                let passAccuracy = passSkill * (staminaFactor * 0.3 + 0.7);

                // Passing style: short = safer; direct = riskier but can trigger through-balls
                if (team === 'player') {
                    if (this.tactics.passing === 'short')  passAccuracy = Math.min(0.96, passAccuracy * 1.06);
                    if (this.tactics.passing === 'direct') passAccuracy *= 0.92;
                }

                if (Math.random() > Math.min(0.96, passAccuracy)) {
                    const lostDesc = team === 'player' && this.tactics.passing === 'direct'
                        ? `⚪ <b class="ev-name">${passer.name}</b>'s direct pass is intercepted!`
                        : `⚪ <b class="ev-name">${passer.name}</b> gives the ball away!`;
                    this.addEvent(lostDesc, 'pass', team);
                    return;
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
                        this.matchFlow.onEvent('offside', { team }); // team = the offside attacker's team
                        this.momentum = team === 'player'
                            ? Math.max(0,   this.momentum - 4)
                            : Math.min(100, this.momentum + 4);
                        return;
                    }
                }

                // Describe pass quality based on vision and passing style
                const vision = passer.vision || 60;
                const styleLabel = (team === 'player' && this.tactics.passing === 'direct') ? 'direct ball'
                                 : (team === 'player' && this.tactics.passing === 'short')  ? 'short pass'
                                 : (vision > 80 ? 'incisive ball' : vision > 65 ? 'good pass' : 'short pass');
                const passDesc = styleLabel;

                if (team === 'player') {
                    this.stats.playerPasses++;
                    this.addEvent(`⚪ <b class="ev-name">${passer.name}</b> — ${passDesc} to <b class="ev-name">${receiver.name}</b>`, 'pass', team);
                    if (this.matchFlow) this.matchFlow.onEvent('pass', { passer: passerId, receiver: receiverId, team });
                } else {
                    this.stats.cpuPasses++;
                    this.addEvent(`⚪ <b class="ev-name">${passer.name}</b> threads a ${passDesc} to <b class="ev-name">${receiver.name}</b>`, 'pass', team);
                    if (this.matchFlow) this.matchFlow.onEvent('pass', { passer: passerId + baseId, receiver: receiverId + baseId, team });
                }
                this.updatePossession();
            }

            saveEvent() {
                // Saving team is the one being attacked
                const team = this.momentum > 55 ? 'cpu' : this.momentum < 45 ? 'player' : (Math.random() > 0.5 ? 'player' : 'cpu');
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const keeper = teamObj.onField.find(p => p.position === 'GK');

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
                if (this.matchFlow) this.matchFlow.onEvent('save', { team });
            }

            substitutionEvent() {
                const team = Math.random() > 0.5 ? 'player' : 'cpu';
                if (!this.rules.canSubstitute(team)) return;
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const sub = teamObj.makeSubstitution();

                if (sub) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    this.rules.recordSub(team);
                    this.substitutions.push({ team, playerOut: sub.playerOut.name, playerIn: sub.playerIn.name, time: `${minute}'` });
                    this.addEvent(
                        `🔄 Sub (${minute}'): <b class="ev-name">${sub.playerOut.name}</b> off, <b class="ev-name">${sub.playerIn.name}</b> on!`,
                        'tackle', team
                    );
                }
            }

            possessionChange() {
                const change = Math.random() > 0.5 ? 5 : -5;
                this.stats.playerPossession = Math.max(30, Math.min(70, this.stats.playerPossession + change));
                this.updatePossession();
                const team = change > 0 ? 'player' : 'cpu';
                if (this.matchFlow) this.matchFlow.onEvent('possession', { team });
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
                this.addEvent(`❌ <b class="ev-name">${player.name}</b> ${missDesc}`, 'chance', team);
                if (this.matchFlow) this.matchFlow.onEvent('miss', { team });
            }

            barEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const player = teamObj.getRandomPlayer(true);

                if (team === 'player') {
                    this.stats.playerShots++;
                    this.addEvent(`🔴 <b class="ev-name">${player.name}</b> hits the crossbar!`, 'save', team);
                } else {
                    this.stats.cpuShots++;
                    this.addEvent(`🔴 <b class="ev-name">${player.name}</b> strikes the bar!`, 'save', team);
                }
                if (this.matchFlow) this.matchFlow.onEvent('bar', { team });
            }

            cornerEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const player = teamObj.getRandomPlayer(true);
                this.addEvent(`🚩 Corner kick! <b class="ev-name">${player.name}</b> delivers into the box`, 'pass', team);
                if (this.matchFlow) this.matchFlow.onEvent('corner', { team });
            }

            throwInEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const player = teamObj.getRandomPlayer(true);
                // Pick a realistic throw-in location along the touchline
                const sideY  = Math.random() > 0.5 ? 2 : 98;
                const throwX = 18 + Math.random() * 64;
                this.addEvent(`🤾 Throw-in by <b class="ev-name">${player.name}</b>`, 'pass', team);
                if (this.matchFlow) this.matchFlow.onEvent('throwin', { team, sideY, throwX });
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
                    this.addEvent(
                        `🟡 YELLOW CARD (${minute}') — <b class="ev-name">${player.name}</b> is booked!` +
                        (count === 1 ? ' One more and they walk.' : ''),
                        'card', team
                    );
                } else if (result.cardType === 'second_yellow') {
                    this.cardData[team].push({ player: player.name, type: 'yellow', time: minute });
                    this.cardData[team].push({ player: player.name, type: 'red',    time: minute });
                    this.addEvent(
                        `🟡🔴 SECOND YELLOW (${minute}') — <b class="ev-name">${player.name}</b> is sent off!`,
                        'card', team
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
                    this.addEvent(
                        `🔴 RED CARD (${minute}') — <b class="ev-name">${player.name}</b> is sent off!`,
                        'card', team
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
                    this.addEvent(`⚠️ <b class="ev-name">${injuredPlayer.name}</b> receives treatment on the touchline`, 'injury', team);
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
                    teamObj.bench.push(injuredPlayer);
                    this.rules.recordSub(team);
                    this.substitutions.push({ team, playerOut: injuredPlayer.name, playerIn: replacement.name, time: `${minute}'` });
                    this.addEvent(
                        `🚑 <b class="ev-name">${injuredPlayer.name}</b> stretchered off (${minute}')! <b class="ev-name">${replacement.name}</b> comes on`,
                        'injury', team
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

                if (r < goalP) {
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 18); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 14); }
                    this.goals.push({ team, scorer: taker.name, assister: null, time: `${minute}'` });
                    this.addEvent(`⚽ GOAL — <b class="ev-name">${taker.name}</b> coolly slots home the penalty!`, 'goal', team);
                    if (this.matchFlow) this.matchFlow.onEvent('goal', { team });
                    this.showCelebration(taker, team);
                } else if (r < goalP + (1 - goalP) * 0.55 && gk) {
                    this.addEvent(`🧤 SAVED! <b class="ev-name">${gk.name}</b> dives to push the penalty away!`, 'save', team === 'player' ? 'cpu' : 'player');
                    if (this.matchFlow) this.matchFlow.onEvent('save', { team: team === 'player' ? 'cpu' : 'player' });
                } else {
                    this.addEvent(`❌ <b class="ev-name">${taker.name}</b> blazes the penalty over the bar!`, 'chance', team);
                }
            }

            freeKickEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const defTeamObj = team === 'player' ? this.cpuTeam : this.playerTeam;
                if (teamObj.onField.length === 0) return;

                // Specialist: highest finishing + crossing among onfield
                const taker = teamObj.onField.slice().sort((a,b) =>
                    ((b.finishing||0) + (b.crossing||0)) - ((a.finishing||0) + (a.crossing||0))
                )[0] || teamObj.getRandomPlayer(true);

                const gk = defTeamObj.onField.find(p => p.position === 'GK');
                this.addEvent(`📐 Dangerous free kick — <b class="ev-name">${taker.name}</b> stands over it...`, 'pass', team);

                const skill = ((taker.finishing || 60) + (taker.crossing || 60)) / 2 / 100;
                const r = Math.random();
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;

                if (r < skill * 0.18) {
                    // Direct free kick goal
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 16); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 12); }
                    this.goals.push({ team, scorer: taker.name, assister: null, time: `${minute}'` });
                    this.addEvent(`⚽ GOAL — <b class="ev-name">${taker.name}</b> curls a stunning free kick into the top corner!`, 'goal', team);
                    if (this.matchFlow) this.matchFlow.onEvent('goal', { team });
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

                const skill = ((shooter.finishing || 55) + (shooter.composure || 60)) / 200;
                const r = Math.random();
                if (r < skill * 0.22) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 14); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 10); }
                    this.goals.push({ team, scorer: shooter.name, assister: null, time: `${minute}'` });
                    this.addEvent(`⚽ SCREAMER! <b class="ev-name">${shooter.name}</b> lets fly from 25 yards — top bins!`, 'goal', team);
                    if (this.matchFlow) this.matchFlow.onEvent('goal', { team });
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
                    const r = Math.random();
                    const head = (headerer.heading || 60) / 100;
                    if (r < head * 0.25) {
                        this.goalEvent(team);   // headed goal resolves via standard goal flow
                    } else if (r < 0.55) {
                        this.addEvent(`🧤 <b class="ev-name">${headerer.name}</b>'s header is well saved!`, 'save', team === 'player' ? 'cpu' : 'player');
                    } else {
                        this.addEvent(`💢 <b class="ev-name">${headerer.name}</b> rises but heads it over!`, 'chance', team);
                    }
                } else {
                    const cbs = teamObj.onField.filter(p => ['CB','CDM'].includes(p.position));
                    const clearer = cbs.length ? cbs[Math.floor(Math.random() * cbs.length)] : teamObj.getRandomPlayer(true);
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
                if (this.matchFlow) this.matchFlow.onEvent('pass', { team });
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

                this.addEvent(`🎯 <b class="ev-name">${striker.name}</b> is clean through, one-on-one with the keeper!`, 'chance', team);
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;

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
                this.goals.push({ team: benefits, scorer: `${culprit.name} (OG)`, assister: null, time: `${minute}'` });
                this.addEvent(`😱 OWN GOAL (${minute}')! <b class="ev-name">${culprit.name}</b> turns the ball into his own net!`, 'goal', benefits);
                if (this.matchFlow) this.matchFlow.onEvent('goal', { team: benefits });
            }

            goalDisallowedEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const scorer = teamObj.getRandomPlayer(true);
                const reason = Math.random() < 0.6 ? 'offside' : 'foul in the build-up';
                this.addEvent(`🚫 GOAL DISALLOWED — <b class="ev-name">${scorer.name}</b>'s effort ruled out for ${reason}!`, 'card', team);
                if (this.matchFlow) this.matchFlow.onEvent('offside', { team });
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

                const skill = ((acrobat.finishing || 65) + (acrobat.composure || 65) + (acrobat.luck || 50)) / 300;
                if (Math.random() < skill * 0.35) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    if (team === 'player') { this.playerScore++; this.momentum = Math.min(100, this.momentum + 22); }
                    else                   { this.cpuScore++;    this.momentum = Math.max(0,   this.momentum - 16); }
                    this.goals.push({ team, scorer: acrobat.name, assister: null, time: `${minute}'` });
                    this.addEvent(`🤸 WONDER GOAL — <b class="ev-name">${acrobat.name}</b> with an outrageous ${move}!`, 'goal', team);
                    if (this.matchFlow) this.matchFlow.onEvent('goal', { team });
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
                this.addEvent(`🚩 Offside! <b class="ev-name">${caught.name}</b> is caught the wrong side of the last defender`, 'pass', attTeam);
                if (this.matchFlow) this.matchFlow.onEvent('offside', { team: attTeam });
            }

            goalmouthScrambleEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                const p1 = teamObj.getRandomPlayer(true);
                this.addEvent(`💥 Goalmouth scramble! <b class="ev-name">${p1?.name || 'A player'}</b> goes close as bodies fly in the six-yard box!`, 'chance', team);
                if (team === 'player') this.stats.playerShots++; else this.stats.cpuShots++;
            }

            // ─── Flavor events (no possession change, atmosphere) ────────────────────

            streakerEvent() {
                this.addEvent(`🩲 A streaker has invaded the pitch! Stewards give chase as the players look on bemused...`, 'card');
            }
            pitchInvaderEvent() {
                this.addEvent(`👤 An over-excited supporter rushes onto the pitch! Play is briefly halted.`, 'card');
            }
            crowdChantEvent() {
                const chants = [
                    'The home end is in full voice!',
                    'The away fans are belting out their anthem.',
                    '"Olé! Olé! Olé!" rings around the stadium.',
                    'The crowd whistles every touch from the visitors.',
                ];
                this.addEvent(`📣 ${chants[Math.floor(Math.random() * chants.length)]}`, 'pass');
            }
            weatherEvent() {
                const w = ['☔ Rain begins to lash down — the pitch is getting slick.',
                           '🌫️ A thick fog rolls in across the stadium.',
                           '🌬️ A swirling wind is making life hard for the goalkeepers.',
                           '❄️ Light snow flurries are blowing across the pitch.'];
                this.addEvent(w[Math.floor(Math.random() * w.length)], 'pass');
            }
            floodlightEvent() {
                this.addEvent(`💡 One of the floodlights flickers — brief delay as the officials check it.`, 'card');
            }
            managerArguesEvent(team) {
                const teamObj = team === 'player' ? this.playerTeam : this.cpuTeam;
                this.addEvent(`📋 The ${teamObj?.clubName || 'manager'} boss is raging at the fourth official on the touchline!`, 'card', team);
            }
            ballBoyEvent() {
                this.addEvent(`👦 A ball boy holds onto the ball just a touch too long — words exchanged!`, 'pass');
            }

            updatePossession() {
                this.stats.cpuPossession = 100 - this.stats.playerPossession;
            }

            updateStats() {
                this.updatePossession();

                // CM 03/04-style fatigue: determination slows stamina drain, GKs tire at reduced rate
                const drainPlayer = (p) => {
                    const det = (p.determination || 70) / 100;
                    const baseRate = p.position === 'GK' ? 0.08 : 0.28;
                    const drain = baseRate * (1 - det * 0.35); // high determination → less drain
                    p.stamina = Math.max(10, p.stamina - drain);
                };

                if (this.playerTeam) this.playerTeam.onField.forEach(drainPlayer);
                if (this.cpuTeam) this.cpuTeam.onField.forEach(drainPlayer);

                // Live-refresh the per-player stamina bars on the match pitch.
                if (this.pitchRenderer) {
                    this.playerTeam?.onField?.forEach((p, i) => this.pitchRenderer.updateStamina(i,       p.stamina));
                    this.cpuTeam?.onField?.forEach   ((p, i) => this.pitchRenderer.updateStamina(100 + i, p.stamina));
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
            }

            addEvent(message, type, team = null) {
                const eventsLog = document.getElementById('eventsLog');
                const eventEl = document.createElement('div');
                eventEl.className = `event ${type}`;
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
                eventsLog.appendChild(eventEl);
                eventsLog.scrollTop = eventsLog.scrollHeight;
            }

            togglePause() {
                this.isPaused = !this.isPaused;
                document.getElementById('pauseBtn').textContent = this.isPaused ? 'Resume' : 'Pause';
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
                this.isPreMatch = false;
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                this.renderManagementPanel();
                this.switchScreen('managementScreen');
            }

            closeManagement() {
                this.isPaused = false;
                this.selectedPlayerOut = null;
                this.selectedPlayerIn = null;
                this.switchScreen('matchScreen');
            }

            renderFormationPitch() {
                const pitch = document.getElementById('formationPitch');
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
                        const stamPct = Math.max(0, Math.min(100, Math.round(p.stamina ?? 100)));
                        const stamCol = this._staminaColor(stamPct);
                        return `<button class="fm-player-slot${sel ? ' selected' : ''}"
                                style="left:${cx}%;top:${cy}%;transform:translate(-50%,-50%);"
                                draggable="true"
                                data-player-id="${p.id}"
                                data-default-x="${defX}" data-default-y="${defY}">
                            <div class="fm-player-avatar">${avatarSVG}</div>
                            <span class="fm-player-name">${lastName}</span>
                            <span class="fm-player-meta">${p.position} · <b style="color:${ovrColor};">${ovr}</b></span>
                            <div class="stamina-bar" title="Stamina ${stamPct}%">
                                <div class="stamina-bar-fill" style="width:${stamPct}%;background:${stamCol};"></div>
                            </div>
                        </button>`;
                    }).join('')}
                    <div class="fm-formation-label">${fmtLabels[formation] || formation}</div>
                `;

                // Wire click → context menu, plus drag handlers.
                pitch.querySelectorAll('.fm-player-slot').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const id = parseInt(btn.dataset.playerId);
                        const p  = squad.find(pl => pl.id === id);
                        if (p) this._showPlayerContextMenu(p, e.clientX, e.clientY);
                    });
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

                title.textContent = `${player.flag ? player.flag + ' ' : ''}${player.name} (${player.position})`;

                menu.querySelectorAll('.context-menu-item').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const action = btn.dataset.action;
                        this._hideAllPlayerPopovers();
                        if (action === 'details')           this.showPlayerDetail(player);
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

                const isFwd = ['ST','CF','CAM','LW','RW'].includes(player.position);
                const rows = [
                    { key: 'forwardRuns',  label: 'Forward Runs',  opts: ['rarely','mixed','often'] },
                    { key: 'runWithBall',  label: 'Run With Ball', opts: ['rarely','mixed','often'] },
                    { key: 'longShots',    label: 'Long Shots',    opts: ['rarely','mixed','often'] },
                    { key: 'throughBalls', label: 'Through Balls', opts: ['rarely','mixed','often'] },
                    { key: 'holdUpBall',   label: 'Hold Up Ball',  opts: ['no','yes'], show: isFwd },
                    { key: 'freeRole',     label: 'Free Role',     opts: ['no','yes'] },
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
                const crestEl = document.getElementById('managementCrest');
                const titleEl = document.getElementById('managementTitle');
                if (crestEl && this.playerTeam) {
                    crestEl.innerHTML = this.playerTeam.crestSVGSm;
                    if (titleEl) titleEl.textContent = this.isPreMatch ? '⚽ PICK YOUR SQUAD ⚽' : this.playerTeam.clubName;
                }

                // Re-renders implicitly close any open detail overlay or floating popover.
                const detailOverlay = document.getElementById('playerDetailOverlay');
                if (detailOverlay) detailOverlay.style.display = 'none';
                this._hideAllPlayerPopovers?.();

                // Toggle pre-match vs in-match UI
                const formSel = document.getElementById('mgmtFormationSelector');
                const startSec = document.getElementById('startMatchSection');
                const subCtrl = document.getElementById('subControls');
                if (formSel) formSel.style.display = this.isPreMatch ? 'block' : 'none';
                if (startSec) startSec.style.display = this.isPreMatch ? 'block' : 'none';
                if (subCtrl) subCtrl.style.display = 'block';
                const closeBtnEl = document.getElementById('closeManageBtn');
                if (closeBtnEl) closeBtnEl.style.display = this.isPreMatch ? 'none' : 'block';

                // Highlight selected formation button
                if (this.isPreMatch && this.playerFormation) {
                    document.querySelectorAll('.formation-btn').forEach(b => {
                        b.classList.toggle('selected', b.dataset.formation === this.playerFormation);
                    });
                }

                // Sync tactic button active states
                document.querySelectorAll('.tactic-btn').forEach(b => {
                    b.classList.toggle('active', this.tactics[b.dataset.tactic] === b.dataset.value);
                });

                // Render formation pitch (left column)
                this.renderFormationPitch();

                // Render bench / player list (left column).
                // Bench: click → details (drag is the only path to substitute).
                const benchList = document.getElementById('benchList');
                if (benchList) {
                    benchList.innerHTML = '';
                    this.playerTeam.bench.forEach(player => {
                        const playerEl = this.createPlayerElement(player, false);
                        playerEl.setAttribute('draggable', 'true');
                        playerEl.addEventListener('click', () => this.showPlayerDetail(player));
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
                const stamPct   = Math.max(0, Math.min(100, Math.round(player.stamina ?? 100)));
                const stamCol   = this._staminaColor(stamPct);

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex-shrink: 0;">
                            ${avatarSVG}
                        </div>
                        <div class="player-info" style="flex: 1;">
                            <div class="player-name">${player.flag ? player.flag + ' ' : ''}${player.name}</div>
                            <div class="player-position">${player.nationality ? player.nationality + ' · ' : ''}${player.position} · <span style="font-weight:600;color:var(--c-text-1);">#${player.number}</span></div>
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

                if (!this.isPreMatch) {
                    const minute = this.rules.getMatchMinute(this.timeRemaining);
                    this.rules.recordSub('player');
                    this.substitutions.push({ team: 'player', playerOut: this.selectedPlayerOut.name, playerIn: this.selectedPlayerIn.name, time: `${minute}'` });
                    this.addEvent(`🔄 Sub (${minute}'): <b class="ev-name">${this.selectedPlayerOut.name}</b> off, <b class="ev-name">${this.selectedPlayerIn.name}</b> on!`, 'tackle', 'player');
                }

                this.selectedPlayerOut = null;
                this.selectedPlayerIn  = null;

                // Sub changed who's on the pitch → refresh MatchFlow's id→player map so
                // the new player's instructions drive their movement.
                this._refreshMatchFlowPlayerInfo();

                if (this.isPreMatch) {
                    this.renderManagementPanel();
                } else {
                    this.closeManagement();
                }
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
                    this.isPaused = false;
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
                document.getElementById('pauseBtn').style.display = 'none';
                document.getElementById('endBtn').style.display = 'block';

                this.switchScreen('resultScreen');
                this.displayResult();
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
            }

            reset() {
                if (this.matchFlow) { this.matchFlow.stop(); this.matchFlow = null; }
                this.isPreMatch = true;
                this.playerFormation = '442';
                this.cpuFormation = null;
                this.playerTeam = new Team('You');
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
                this.tactics = { mentality: 'normal', closingDown: 'standard', tackling: 'normal', passing: 'mixed' };
                this.momentum = 50;
                this._attackPhase = null;
                this._attackTeam  = null;
                this._phaseTicks  = 0;
                this.rules.reset();
                this.stats = {
                    playerShots: 0,
                    cpuShots: 0,
                    playerTackles: 0,
                    cpuTackles: 0,
                    playerPasses: 0,
                    cpuPasses: 0,
                    playerPossession: 50,
                    cpuPossession: 50
                };

                document.getElementById('pauseBtn').style.display = 'block';
                document.getElementById('pauseBtn').textContent = 'Pause';
                document.getElementById('manageBtn').style.display = 'none';
                document.getElementById('endBtn').style.display = 'none';
                document.getElementById('stats').style.display = 'none';
                document.getElementById('eventsLog').innerHTML = '<div class="event pass">⚪ Match started! Possession: 50-50</div>';
                // Reset tactic buttons to defaults
                document.querySelectorAll('.tactic-btn').forEach(b => b.classList.remove('active'));
                [['mentality','normal'],['closingDown','standard'],['tackling','normal'],['passing','mixed']].forEach(([k,v]) => {
                    const btn = document.querySelector(`.tactic-btn[data-tactic="${k}"][data-value="${v}"]`);
                    if (btn) btn.classList.add('active');
                });

                this.renderManagementPanel();
                this.switchScreen('managementScreen');
            }
        }

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
