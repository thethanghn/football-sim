/**
 * Free kick scene — flash + rings, then a perspective composition over the pitch
 * with goal frame, GK, four-man wall, foreground taker, ball, and trajectory arc.
 *
 * Split into two halves so each can evolve independently:
 *   drawBackdrop — stadium scenery + pitch (static)
 *   drawObjects  — flash, goal frame, GK, wall, taker, ball, arc, caption (foreground)
 */
(function (NS) {

    function drawBackdrop(draw) {
        const ink = '#0a0a0a';

        // Sky → stand
        const sky = draw.gradient('linear', add => {
            add.stop(0, '#0a1428');
            add.stop(1, '#1c3960');
        }).from(0, 0).to(0, 1);
        draw.rect(100, 8).fill(sky);
        draw.rect(100, 3).fill('#2a2a2a').move(0, 8);

        // Crowd — three rows behind the goal
        const crowdColors = ['#cc0000','#1133cc','#dddd00','#cc6600','#ff00ff','#00CCCC','#FFFFFF','#22C55E','#A855F7'];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 32; col++) {
                const cx = col * 3.2 + 1 + (row % 2 ? 1.6 : 0);
                const cy = 12 + row * 2.4;
                const color = crowdColors[Math.floor(Math.random() * crowdColors.length)];
                draw.circle(1.6).fill(color).stroke({ color: ink, width: 0.15 }).center(cx, cy).opacity(0.9);
            }
        }

        // Hoarding (barrier + white panel + advert blocks)
        draw.rect(100, 1.4).fill('#444').move(0, 20);
        draw.rect(100, 1.6).fill('#FFFFFF').move(0, 21.4).opacity(0.85);
        for (let i = 0; i < 5; i++) {
            const adv = crowdColors[Math.floor(Math.random() * crowdColors.length)];
            draw.rect(18, 1.6).fill(adv).move(i * 20, 21.5).opacity(0.45);
        }

        // Touchline
        draw.rect(100, 0.5).fill('#FFFFFF').move(0, 23);

        // Pitch — opaque green with perspective mowing stripes (wider toward viewer)
        draw.rect(100, 77).fill('#1a7a1a').move(0, 23.5);
        [
            { y: 26, h: 6 }, { y: 42, h: 10 }, { y: 67, h: 16 },
        ].forEach(b => {
            draw.rect(100, b.h).fill('#268f26').move(0, b.y).opacity(0.55);
        });

        // ── Penalty area markings ──────────────────────────────────────
        // Goal line at y=27 (matches the goal-frame bottom in drawObjects).
        // 18-yard box spans y=27→50 (deep), x=10→90. 6-yard box nested inside.
        // Penalty spot at (50, 40); arc curves out the top of the box.
        const line = '#FFFFFF';
        const lw   = 0.45;

        // Goal line across the pitch (slightly faded — it lives under the goal posts)
        draw.line(0, 27, 100, 27).stroke({ color: line, width: lw, opacity: 0.7 });

        // 18-yard box (penalty area)
        draw.line(10, 27, 10, 50).stroke({ color: line, width: lw });
        draw.line(90, 27, 90, 50).stroke({ color: line, width: lw });
        draw.line(10, 50, 90, 50).stroke({ color: line, width: lw });

        // 6-yard box
        draw.line(27, 27, 27, 37).stroke({ color: line, width: lw });
        draw.line(73, 27, 73, 37).stroke({ color: line, width: lw });
        draw.line(27, 37, 73, 37).stroke({ color: line, width: lw });

        // Penalty spot
        draw.circle(1).fill(line).center(50, 40);

        // Penalty arc — half-circle on the field side of the 18-yard line
        draw.path('M 40,50 Q 50,56 60,50').fill('none').stroke({ color: line, width: lw });
    }

    function drawObjects(draw, p) {
        // Colour keys (with legacy aliases for the existing main-game payload)
        const takerColor = p.takerColor || p.attackColor || '#FFD700';
        const wallColor  = p.wallColor  || p.defendColor || '#EF4444';
        const gkColor    = p.gkColor    || '#39FF14';
        const ink = '#0a0a0a';

        // Pick real players from the rosters when provided so heads carry real
        // faces / hairstyles / build. Falls back to stub objects (only the
        // shirt number is used) when no roster is supplied — preserves the old
        // colour-only behaviour for any caller that hasn't been updated yet.
        const atk = (Array.isArray(p.attackTeam) ? p.attackTeam : []).slice().sort(() => 0.5 - Math.random());
        const def = (Array.isArray(p.defendTeam) ? p.defendTeam : []).slice().sort(() => 0.5 - Math.random());
        const gkPlayer    = def.find(q => q?.position === 'GK') || def[0] || { number: 1 };
        const wallPool    = def.filter(q => q !== gkPlayer);
        const wallPlayers = [0, 1, 2, 3].map(i => wallPool[i] || null);
        // Prefer the simulator-picked specialist if supplied; otherwise grab
        // the first shuffled attacker. Default is right-footed.
        const takerPlayer    = p.taker || atk[0] || { number: 9, foot: 'right' };
        const boxAttackers   = [atk[1] || null, atk[2] || null];   // 2 same-team runners in the box

        // Opening flash + expanding rings
        NS._flashAndRings(draw, takerColor);

        // Goal frame (bottom edge sits on the goal line at y=27)
        const goal = draw.group().opacity(0);
        goal.rect(36, 1.4).fill('#FFFFFF').stroke({ color: ink, width: 0.3 }).center(50, 9);
        goal.rect(1.2, 19).fill('#FFFFFF').stroke({ color: ink, width: 0.3 }).center(33, 18);
        goal.rect(1.2, 19).fill('#FFFFFF').stroke({ color: ink, width: 0.3 }).center(67, 18);
        for (let i = 1; i <= 4; i++) {
            const yLine = 9 + i * 3.6;
            goal.line(34, yLine, 66, yLine).stroke({ color: 'rgba(255,255,255,0.35)', width: 0.25 });
        }
        for (let i = 1; i <= 5; i++) {
            const xLine = 34 + i * 5.4;
            goal.line(xLine, 9, xLine, 27).stroke({ color: 'rgba(255,255,255,0.35)', width: 0.25 });
        }
        setTimeout(() => goal.animate(400).opacity(1), 450);

        // GK — standing on the goal line, ready to dive
        const gk = draw.group().opacity(0);
        NS._figure(gk, 50, 30, gkPlayer, gkColor, 0.7);
        setTimeout(() => gk.animate(350).opacity(1), 600);

        // 2 attacking team-mates lurking in the box for a rebound / second ball
        const boxSpots = [{ x: 28, y: 42 }, { x: 72, y: 42 }];
        boxSpots.forEach((spot, i) => {
            const g = draw.group().opacity(0);
            NS._figure(g, spot.x, spot.y, boxAttackers[i], takerColor, 0.7);
            setTimeout(() => g.animate(280).opacity(0.95), 680 + i * 90);
        });

        // 4-man defensive wall, shoulder-to-shoulder just outside the 18-yard line
        const wallStartX = 38, wallSpacing = 8, wallY = 56;
        for (let i = 0; i < 4; i++) {
            const wx = wallStartX + i * wallSpacing;
            const playerG = draw.group().opacity(0);
            NS._figure(playerG, wx, wallY, wallPlayers[i], wallColor, 1.0);
            setTimeout(() => playerG.animate(280).opacity(1), 800 + i * 90);
        }

        // Ball position (kept fixed at the spot — the kicker offsets around it)
        const ballX = 50, ballY = 88;

        // Taker (foreground, big) — back to the viewer, facing the goal.
        // Foot dictates which side of the ball the kicker stands on:
        //   right-footed → body to the LEFT of the ball (plants left foot, swings right)
        //   left-footed  → body to the RIGHT of the ball (plants right foot, swings left)
        //   two-footed   → defaults to right-footed positioning
        // Offset of 7 viewbox units keeps the (scale 1.6) torso + shoulders well
        // clear of the ball's 1.6-unit radius.
        const kickFoot = takerPlayer?.foot || 'right';
        const standsLeftOfBall = kickFoot !== 'left';       // right + both stand left
        const takerOffset = 7 * (standsLeftOfBall ? -1 : 1);
        const taker = draw.group().opacity(0);
        NS._backFigure(taker, ballX + takerOffset, 82, takerPlayer, takerColor, 1.6);
        setTimeout(() => taker.animate(380).opacity(1), 1050);

        // Ball at the spot
        const ball = draw.group().opacity(0);
        ball.circle(3.2).fill('white').stroke({ color: ink, width: 0.5 }).center(ballX, ballY);
        ball.circle(0.7).fill(ink).center(ballX - 0.8, ballY - 0.7);
        ball.circle(0.7).fill(ink).center(ballX + 0.8, ballY + 0.5);
        setTimeout(() => ball.animate(260).opacity(1), 1200);

        const caption = draw.text('FREE KICK')
            .font({ family: 'Arial', size: 6, weight: 'bold' })
            .fill('#FFD700').stroke({ color: ink, width: 0.3 })
            .center(50, 5).opacity(0);
        setTimeout(() => caption.animate(280).opacity(1), 700);
    }

    NS.freekick = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        return 2400;   // a bit longer to let the flash settle before the composition
    };
})(window.DramaticScenes);
