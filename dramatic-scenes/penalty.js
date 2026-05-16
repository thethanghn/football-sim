/**
 * Penalty kick scene — same camera angle as the free-kick scene (looking at
 * the goal from in front of the box) but no defensive wall, and the kicker
 * stands next to the penalty spot with the ball at the spot. A few other
 * players hover at the edge of the 18-yard box waiting for the rebound.
 *
 * drawBackdrop — stadium, pitch, penalty markings.
 * drawObjects  — goal frame, GK, ball at penalty spot, kicker beside the
 *                spot, edge-of-box players, PENALTY! caption.
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

        // Crowd behind the goal
        const crowdColors = ['#cc0000','#1133cc','#dddd00','#cc6600','#ff00ff','#00CCCC','#FFFFFF','#22C55E','#A855F7'];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 32; col++) {
                const cx = col * 3.2 + 1 + (row % 2 ? 1.6 : 0);
                const cy = 12 + row * 2.4;
                const color = crowdColors[Math.floor(Math.random() * crowdColors.length)];
                draw.circle(1.6).fill(color).stroke({ color: ink, width: 0.15 }).center(cx, cy).opacity(0.9);
            }
        }

        // Hoarding
        draw.rect(100, 1.4).fill('#444').move(0, 20);
        draw.rect(100, 1.6).fill('#FFFFFF').move(0, 21.4).opacity(0.85);
        for (let i = 0; i < 5; i++) {
            const adv = crowdColors[Math.floor(Math.random() * crowdColors.length)];
            draw.rect(18, 1.6).fill(adv).move(i * 20, 21.5).opacity(0.45);
        }

        // Touchline
        draw.rect(100, 0.5).fill('#FFFFFF').move(0, 23);

        // Pitch
        draw.rect(100, 77).fill('#1a7a1a').move(0, 23.5);
        [
            { y: 26, h: 6 }, { y: 42, h: 10 }, { y: 67, h: 16 },
        ].forEach(b => {
            draw.rect(100, b.h).fill('#268f26').move(0, b.y).opacity(0.55);
        });

        // ── Penalty area markings ──────────────────────────────────────
        const line = '#FFFFFF';
        const lw   = 0.45;

        draw.line(0, 27, 100, 27).stroke({ color: line, width: lw, opacity: 0.7 });

        // 18-yard box
        draw.line(10, 27, 10, 50).stroke({ color: line, width: lw });
        draw.line(90, 27, 90, 50).stroke({ color: line, width: lw });
        draw.line(10, 50, 90, 50).stroke({ color: line, width: lw });

        // 6-yard box
        draw.line(27, 27, 27, 37).stroke({ color: line, width: lw });
        draw.line(73, 27, 73, 37).stroke({ color: line, width: lw });
        draw.line(27, 37, 73, 37).stroke({ color: line, width: lw });

        // Penalty spot — pulled slightly back toward the GK from the box edge
        // so the spot reads as the middle ground between kicker and keeper.
        draw.circle(1).fill(line).center(50, 44);

        // Penalty arc — half-circle on the field side of the 18-yard line,
        // sized to fit the spot's position (radius 10 from spot at y=44 hits
        // the 18-yard line at x ≈ 42 / 58).
        draw.path('M 42,50 Q 50,54 58,50').fill('none').stroke({ color: line, width: lw });
    }

    function drawObjects(draw, p) {
        const kickerColor = p.kickerColor || p.takerColor || p.attackColor || '#FFD700';
        const defColor    = p.defColor    || p.defendColor              || '#EF4444';
        const gkColor     = p.gkColor                                   || '#39FF14';
        const ink = '#0a0a0a';

        const atk = (Array.isArray(p.attackTeam) ? p.attackTeam : []).slice().sort(() => 0.5 - Math.random());
        const def = (Array.isArray(p.defendTeam) ? p.defendTeam : []).slice().sort(() => 0.5 - Math.random());
        const kickerPlayer   = atk[0] || { number: 9 };
        const otherAttackers = [atk[1] || null, atk[2] || null];
        const gkPlayer       = def.find(q => q?.position === 'GK') || def[0] || { number: 1 };
        const edgeDefenders  = def.filter(q => q !== gkPlayer).slice(0, 2);

        // Goal frame
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
        setTimeout(() => goal.animate(400).opacity(1), 250);

        // GK — standing ON the goal line (feet sit right on y=27), arms wide
        // ready to dive. Sliding side-to-side to psych out the kicker.
        const gk = draw.group().opacity(0);
        NS._figure(gk, 50, 23, gkPlayer, gkColor, 0.7, 'spread');
        setTimeout(() => gk.animate(350).opacity(1), 450);
        // Sine-wave oscillation of the GK's x position. setInterval is cleared
        // when the scene tears down so no leftover timer runs in the page.
        const oscStart = Date.now() + 850;
        const oscInterval = setInterval(() => {
            const t = Date.now() - oscStart;
            if (t < 0) return;
            const offset = Math.sin(t / 230) * 2.8;
            try { gk.attr('transform', `translate(${offset}, 0)`); } catch (e) {}
        }, 50);
        setTimeout(() => clearInterval(oscInterval), 2400);

        // Ball — sitting on the penalty spot
        const ball = draw.group().opacity(0);
        ball.circle(3.2).fill('white').stroke({ color: ink, width: 0.5 }).center(50, 44);
        ball.circle(0.7).fill(ink).center(49.2, 43.3);
        ball.circle(0.7).fill(ink).center(50.8, 44.5);
        setTimeout(() => ball.animate(260).opacity(1), 650);

        // Kicker — standing right next to the penalty spot, hands on hips
        // (focused, calm-before-the-storm pose)
        const kicker = draw.group().opacity(0);
        NS._figure(kicker, 45, 55, kickerPlayer, kickerColor, 1.1, 'hips');
        setTimeout(() => kicker.animate(380).opacity(1), 800);

        // Mixed players hovering at the edge of the 18-yard box, waiting
        // for any rebound. Two attackers (same kit as the kicker) on the
        // wings, two defenders flanking the centre. Each one gets a
        // different hand gesture to convey the tension.
        const edgeSpots = [
            { x: 22, y: 60, player: otherAttackers[0], color: kickerColor, gesture: 'onHead' },
            { x: 38, y: 62, player: edgeDefenders[0],  color: defColor,    gesture: 'hips'   },
            { x: 62, y: 62, player: edgeDefenders[1],  color: defColor,    gesture: 'onHead' },
            { x: 78, y: 60, player: otherAttackers[1], color: kickerColor, gesture: 'hips'   },
        ];
        edgeSpots.forEach((s, i) => {
            const g = draw.group().opacity(0);
            NS._figure(g, s.x, s.y, s.player, s.color, 0.9, s.gesture);
            setTimeout(() => g.animate(280).opacity(0.95), 1000 + i * 90);
        });

        // PENALTY! caption at top
        const caption = draw.text('PENALTY!')
            .font({ family: 'Arial', size: 8, weight: 'bold' })
            .fill('#FFD700').stroke({ color: ink, width: 0.4 })
            .center(50, 5).opacity(0);
        setTimeout(() => caption.animate(280).opacity(1), 350);

        // Optional "fouled by …" sub-line — keeps the old payload's name + minute
        // working in case any caller still passes them.
        if (p.name) {
            const text = `fouled by ${p.name}${p.minute ? "  ·  " + p.minute + "'" : ''}`;
            const badge = NS._nameBadge(draw, text, 50, 95, {
                fontSize: 3.6,
                borderColor: '#FFD700',
                padding: 1.2,
            });
            badge.opacity(0);
            setTimeout(() => badge.animate(280).opacity(1), 1400);
        }
    }

    NS.penalty = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        // Tense build-up sound — fires if an AudioFx instance is on the page
        // (the main game exposes `window.game.audio`; the test bench exposes
        // `window.audio`).
        try {
            const audio = window.audio || window.game?.audio;
            audio?.penaltyTension?.();
        } catch (e) {}
        return 2400;
    };
})(window.DramaticScenes);
