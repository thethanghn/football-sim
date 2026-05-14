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

                this.svg.appendChild(playerG);
                this.playerVisuals[playerId] = { element: playerG, x: coords.x, y: coords.y, pitchX: x, pitchY: y };
                return playerG;
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

                    const manageBtn = document.getElementById('manageBtn');
                    if (manageBtn) manageBtn.addEventListener('click', () => this.openManagement());

                    const closeManageBtn = document.getElementById('closeManageBtn');
                    if (closeManageBtn) closeManageBtn.addEventListener('click', () => this.closeManagement());

                    const confirmSubBtn = document.getElementById('confirmSubBtn');
                    if (confirmSubBtn) confirmSubBtn.addEventListener('click', () => this.confirmSubstitution());

                    const playAgainBtn = document.getElementById('playAgainBtn');
                    if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.reset());

                    document.querySelectorAll('.tactic-btn').forEach(btn => {
                        btn.addEventListener('click', () => this.setTactic(btn.dataset.tactic, btn.dataset.value));
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

            showPlayerDetail(player) {
                const isMobile = window.matchMedia('(max-width: 640px)').matches;
                const panel = document.getElementById(isMobile ? 'mobilePlayerDetail' : 'playerDetailPanel');
                const avatar = AvatarGenerator.createSVG(player.avatar, 80);

                panel.innerHTML = `
                    <div class="player-detail-header" style="margin-bottom: 15px;">
                        <div style="flex-shrink: 0; margin-right: 15px;">
                            ${avatar}
                        </div>
                        <div class="player-detail-info">
                            <div class="player-detail-name">${player.flag ? player.flag + ' ' : ''}${player.name}</div>
                            <div class="player-detail-position">${player.nationality ? player.nationality + ' · ' : ''}${player.position} <span style="font-size:1.1em;font-weight:bold;color:#FFD700;">${this.calculateOverall(player)}</span></div>
                            <div class="player-detail-number">#${player.number}</div>
                        </div>
                    </div>
                    <div class="radar-chart-container">
                        <svg id="radarChart" width="200" height="200" viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg"></svg>
                    </div>
                    <div class="attribute-bars" id="attributeBars"></div>
                    <button class="close-detail-btn" id="closeDetailBtn">Close Details</button>
                `;

                this.createRadarChart(player);
                this.createAttributeBars(player);

                document.getElementById('closeDetailBtn').onclick = () => {
                    panel.innerHTML = isMobile
                        ? ''
                        : '<div style="text-align: center; color: #FFD700; padding: 20px; font-weight: bold;">Tap a player to view details</div>';
                };
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

                const isGK = player.position === 'GK';
                const attrs = [
                    { name: 'Stamina', key: 'stamina' },
                    { name: 'Strength', key: 'strength' },
                    { name: 'Speed', key: 'speed' },
                    { name: 'Shooting', key: 'shooting' },
                    { name: 'Passing', key: 'passing' },
                    { name: isGK ? 'Reflex' : 'Heading', key: 'heading' },
                    { name: isGK ? 'Goalkeeping' : 'Tackling', key: 'tackling' },
                    { name: 'Offensive', key: 'offensive' },
                    { name: 'Defensive', key: 'defensive' }
                ];

                attrs.forEach(attr => {
                    const value = Math.min(100, player[attr.key]);
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

            setupPitchPlayers() {
                try {
                    console.log('setupPitchPlayers called');
                    const formPlayer = [1, ...this.playerFormation.split('').map(Number)];
                    const formCpu = [1, ...this.cpuFormation.split('').map(Number)];
                    console.log('Player formation:', formPlayer, 'CPU formation:', formCpu);

                    const playerPositions = this.pitchRenderer.calculatePositions(formPlayer, 1);
                    const cpuPositions = this.pitchRenderer.calculatePositions(formCpu, 2);
                    console.log('Calculated positions. Player count:', playerPositions.length, 'CPU count:', cpuPositions.length);

                    console.log('Rendering player team...');
                    this.playerTeam.onField.forEach((player, idx) => {
                        if (idx < playerPositions.length) {
                            const pos = playerPositions[idx];
                            this.pitchRenderer.renderPlayer(idx, pos.x, pos.y, player.number, this.playerTeam.jerseyColor, player.name);
                        }
                    });
                    console.log('Player team rendered');

                    console.log('Rendering CPU team...');
                    this.cpuTeam.onField.forEach((player, idx) => {
                        if (idx < cpuPositions.length) {
                            const pos = cpuPositions[idx];
                            this.pitchRenderer.renderPlayer(idx + 100, pos.x, pos.y, player.number, this.cpuTeam.jerseyColor, player.name);
                        }
                    });
                    console.log('CPU team rendered');

                    this.pitchRenderer.renderBall(50, 50);
                    console.log('Ball rendered');

                    if (this.matchFlow) this.matchFlow.stop();
                    this.matchFlow = new MatchFlow(this.pitchRenderer, this.animationEngine);
                    this.matchFlow.init(playerPositions, cpuPositions);
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
                const eventInterval = setInterval(() => {
                    if (!this.isPaused && this.isRunning) {
                        this.generateEvent();
                        this.updateStats();
                        this.updateUI();
                    }
                }, 500);

                const timerInterval = setInterval(() => {
                    if (!this.isPaused && this.isRunning) {
                        this.timeRemaining--;
                        this.updateUI();

                        if (this.timeRemaining <= 0) {
                            clearInterval(eventInterval);
                            clearInterval(timerInterval);
                            this.endMatch();
                        }
                    }
                }, 1000);
            }

            // CM 03/04-style zone ratings: weighted attribute averages per zone
            getZoneRatings(teamObj, formation) {
                if (!teamObj || teamObj.onField.length === 0) return { attack: 50, midfield: 50, defense: 50 };

                const bonus = this.getFormationBonus(formation);
                let atkSum = 0, atkN = 0, midSum = 0, midN = 0, defSum = 0, defN = 0;

                teamObj.onField.forEach(p => {
                    const sf = Math.max(0.5, p.stamina / 100); // stamina factor
                    const det = (p.determination || 70) / 100;
                    const fatigueMult = sf + (1 - sf) * det * 0.5; // determination softens fatigue

                    if (['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.position)) {
                        const r = ((p.finishing || 50) * 0.30 + (p.offTheBall || 50) * 0.25 +
                                   (p.composure || 50) * 0.20 + (p.dribbling || 50) * 0.15 +
                                   (p.heading || 50) * 0.10) * fatigueMult;
                        atkSum += r; atkN++;
                    } else if (['CM', 'CDM', 'LM', 'RM'].includes(p.position)) {
                        const r = ((p.passing || 50) * 0.25 + (p.vision || 50) * 0.20 +
                                   (p.creativity || 50) * 0.20 + (p.tackling || 50) * 0.15 +
                                   (p.stamina || 50) * 0.10 + (p.anticipation || 50) * 0.10) * fatigueMult;
                        midSum += r; midN++;
                    } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) {
                        const r = ((p.marking || 50) * 0.30 + (p.tackling || 50) * 0.25 +
                                   (p.heading || 50) * 0.20 + (p.anticipation || 50) * 0.15 +
                                   (p.strength || 50) * 0.10) * fatigueMult;
                        defSum += r; defN++;
                    } else if (p.position === 'GK') {
                        const r = ((p.reflexes || 50) * 0.35 + (p.handling || 50) * 0.30 +
                                   (p.positioning || 50) * 0.20 + (p.composure || 50) * 0.15) * fatigueMult;
                        defSum += r; defN++;
                    }
                });

                return {
                    attack:   (atkN  > 0 ? atkSum  / atkN  : 50) * bonus.attack,
                    midfield: (midN  > 0 ? midSum  / midN  : 50) * bonus.midfield,
                    defense:  (defN  > 0 ? defSum  / defN  : 50) * bonus.defense,
                };
            }

            getFormationBonus(formation) {
                const bonuses = {
                    '442': { attack: 1.00, midfield: 1.00, defense: 1.00 },
                    '433': { attack: 1.10, midfield: 0.95, defense: 0.95 },
                    '451': { attack: 0.92, midfield: 1.18, defense: 1.00 },
                    '532': { attack: 0.90, midfield: 1.00, defense: 1.10 },
                    '541': { attack: 0.82, midfield: 1.05, defense: 1.20 },
                    '352': { attack: 1.05, midfield: 1.12, defense: 0.88 },
                    '343': { attack: 1.12, midfield: 1.05, defense: 0.88 },
                };
                return bonuses[formation] || bonuses['442'];
            }

            generateEvent() {
                // Rare: late-game special events interrupt any phase
                if (this.timeRemaining < 35 && Math.random() < 0.03) {
                    this._attackPhase = null; this.substitutionEvent(); return;
                }
                if (this.timeRemaining < 45 && Math.random() < 0.02) {
                    this._attackPhase = null; this.injuryEvent(); return;
                }

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
                    this.tackleEvent(opp);   // defense presses and wins the ball
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
                    if (r < interceptionChance * 0.65) {
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

                // How long to build in the final third before forcing a shot
                const menMod = team === 'player'
                    ? ({ 'gung-ho': 0, 'attacking': 0, 'normal': 1, 'defensive': 2, 'ultra-def': 2 }[this.tactics.mentality] ?? 1)
                    : 1;
                const pasMod = team === 'player'
                    ? ({ 'direct': 0, 'mixed': 0, 'short': 1 }[this.tactics.passing] ?? 0)
                    : 0;
                const maxProg = menMod + pasMod; // 0–3

                if (this._phaseTicks > maxProg) {
                    this.passEvent(team);        // final ball into the danger zone
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

                // Prefer attackers (ST/CF/LW/RW/CAM) as scorer
                const attackers = teamObj.onField.filter(p => ['ST','CF','LW','RW','CAM'].includes(p.position));
                const scorer = attackers.length > 0
                    ? attackers[Math.floor(Math.random() * attackers.length)]
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
                // Prefer off-the-ball movement positions
                const movers = teamObj.onField.filter(p => ['ST','CF','CAM','LW','RW'].includes(p.position));
                const player = movers.length > 0 ? movers[Math.floor(Math.random() * movers.length)] : teamObj.getRandomPlayer(true);
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

                // Momentum drifts slowly back to 50 (regression)
                this.momentum += (50 - this.momentum) * 0.02;
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

                pitch.innerHTML = `
                    <div class="fm-field-lines">
                        <div class="fm-line-center"></div>
                        <div class="fm-circle-center"></div>
                        <div class="fm-box-top"></div>
                        <div class="fm-box-bot"></div>
                    </div>
                    ${ordered.map((p, i) => {
                        if (!p || !coords[i]) return '';
                        const [cx, cy] = coords[i];
                        const lastName  = p.name.trim().split(/\s+/).pop();
                        const ovr       = this.calculateOverall(p);
                        const sel       = this.selectedPlayerOut?.id === p.id;
                        const avatarSVG = AvatarGenerator.createSVG(p.avatar, 34);
                        return `<button class="fm-player-slot${sel ? ' selected' : ''}"
                                style="left:${cx}%;top:${cy}%;transform:translate(-50%,-50%);"
                                data-player-id="${p.id}">
                            <div class="fm-player-avatar">${avatarSVG}</div>
                            <span class="fm-player-name">${lastName}</span>
                            <span class="fm-player-meta">${p.position} · ${ovr}</span>
                        </button>`;
                    }).join('')}
                    <div class="fm-formation-label">${fmtLabels[formation] || formation}</div>
                `;

                pitch.querySelectorAll('.fm-player-slot').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = parseInt(btn.dataset.playerId);
                        const p  = squad.find(pl => pl.id === id);
                        if (!p) return;
                        this.showPlayerDetail(p);
                        if (!this.isPreMatch) this.selectPlayer(p, true);
                    });
                });
            }

            renderManagementPanel() {
                const crestEl = document.getElementById('managementCrest');
                const titleEl = document.getElementById('managementTitle');
                if (crestEl && this.playerTeam) {
                    crestEl.innerHTML = this.playerTeam.crestSVGSm;
                    if (titleEl) titleEl.textContent = this.isPreMatch ? '⚽ PICK YOUR SQUAD ⚽' : this.playerTeam.clubName;
                }

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

                // Render bench (right column)
                const benchList = document.getElementById('benchList');
                if (benchList) {
                    benchList.innerHTML = '';
                    this.playerTeam.bench.forEach(player => {
                        const playerEl = this.createPlayerElement(player, false);
                        playerEl.addEventListener('click', () => {
                            this.showPlayerDetail(player);
                            if (!this.isPreMatch) this.selectPlayer(player, false);
                        });
                        benchList.appendChild(playerEl);
                    });
                }
            }

            createPlayerElement(player, isOnField) {
                const div = document.createElement('div');
                div.className = `player-item ${isOnField ? 'onfield' : ''}`;
                div.dataset.playerId = player.id;

                const avatarSVG = AvatarGenerator.createSVG(player.avatar, 50);

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <div style="flex-shrink: 0;">
                            ${avatarSVG}
                        </div>
                        <div class="player-info" style="flex: 1;">
                            <div class="player-name">${player.flag ? player.flag + ' ' : ''}${player.name}</div>
                            <div class="player-position">${player.nationality ? player.nationality + ' · ' : ''}${player.position} <span style="font-weight:bold;color:#FFD700;">${this.calculateOverall(player)}</span></div>
                        </div>
                        <div class="player-number">${player.number}</div>
                    </div>
                `;

                // Tap/click to view details
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showPlayerDetail(player);
                });

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

                const noSubsLeft  = !this.isPreMatch && !this.rules.canSubstitute('player');
                const confirmBtn  = document.getElementById('confirmSubBtn');
                confirmBtn.disabled = !this.selectedPlayerOut || !this.selectedPlayerIn || noSubsLeft;

                const info = document.getElementById('managementInfo');
                const subsLeft = this.isPreMatch ? null : this.rules.subsRemaining('player');

                if (noSubsLeft) {
                    info.textContent = `❌ All ${this.rules.MAX_SUBS} substitutions used`;
                    info.style.background = 'rgba(255,68,68,0.12)';
                    info.style.borderColor = '#FF4444';
                    info.style.color = '#FF4444';
                } else if (this.selectedPlayerOut && this.selectedPlayerIn) {
                    info.textContent = `✅ Ready: ${this.selectedPlayerOut.name} → ${this.selectedPlayerIn.name}` +
                        (subsLeft !== null ? `  (${subsLeft} sub${subsLeft !== 1 ? 's' : ''} left)` : '');
                    info.style.background = 'rgba(74,222,128,0.12)';
                    info.style.borderColor = '#4ADE80';
                    info.style.color = '#4ADE80';
                } else {
                    info.textContent = '👤 Click a player from Starting XI and a substitute to swap them' +
                        (subsLeft !== null ? `  (${subsLeft} sub${subsLeft !== 1 ? 's' : ''} left)` : '');
                    info.style.background = 'rgba(255,215,0,0.10)';
                    info.style.borderColor = '#FFD700';
                    info.style.color = '#FFD700';
                }
            }

            confirmSubstitution() {
                if (!this.selectedPlayerOut || !this.selectedPlayerIn) return;

                // During a live match, enforce the substitution quota
                if (!this.isPreMatch && !this.rules.canSubstitute('player')) {
                    const info = document.getElementById('managementInfo');
                    info.textContent = `❌ No substitutions remaining! (${this.rules.MAX_SUBS}/${this.rules.MAX_SUBS} used)`;
                    info.style.background = 'rgba(255,68,68,0.12)';
                    info.style.borderColor = '#FF4444';
                    info.style.color = '#FF4444';
                    return;
                }

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
