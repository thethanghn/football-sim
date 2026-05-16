/**
 * Corner kick scene — side-on camera angle. The pitch runs left-to-right:
 *   LEFT:  corner taker, flag, ball at the corner spot (foreground)
 *   RIGHT: goal frame (drawn in 3/4 view), GK on the line, attackers and
 *          defenders jostling in the penalty area for the incoming cross
 *
 * drawBackdrop — stadium, pitch, pitch markings (18-yard box + 6-yard box +
 *                penalty spot + corner arc) all laid out side-on.
 * drawObjects  — goal frame, GK, box players, corner flag, taker, ball, caption.
 */
(function (NS) {

    function drawBackdrop(draw) {
        const ink = '#0a0a0a';

        // Sky → stand strip (this is the FAR-SIDE stand, opposite to the camera)
        const sky = draw.gradient('linear', add => {
            add.stop(0, '#0a1428');
            add.stop(1, '#1c3960');
        }).from(0, 0).to(0, 1);
        draw.rect(100, 7).fill(sky);
        draw.rect(100, 3).fill('#2a2a2a').move(0, 7);

        // Crowd behind the far touchline
        const crowdColors = ['#cc0000','#1133cc','#dddd00','#cc6600','#ff00ff','#00CCCC','#FFFFFF','#22C55E','#A855F7'];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 32; col++) {
                const cx = col * 3.2 + 1 + (row % 2 ? 1.6 : 0);
                const cy = 11 + row * 2.4;
                const color = crowdColors[Math.floor(Math.random() * crowdColors.length)];
                draw.circle(1.6).fill(color).stroke({ color: ink, width: 0.15 }).center(cx, cy).opacity(0.9);
            }
        }

        // Hoarding
        draw.rect(100, 1.4).fill('#444').move(0, 19);
        draw.rect(100, 1.6).fill('#FFFFFF').move(0, 20.4).opacity(0.85);
        for (let i = 0; i < 5; i++) {
            const adv = crowdColors[Math.floor(Math.random() * crowdColors.length)];
            draw.rect(18, 1.6).fill(adv).move(i * 20, 20.5).opacity(0.45);
        }

        // Far-side touchline
        draw.rect(100, 0.5).fill('#FFFFFF').move(0, 22);

        // Pitch
        draw.rect(100, 78).fill('#1a7a1a').move(0, 22.5);
        [
            { y: 26, h: 6 }, { y: 44, h: 14 }, { y: 72, h: 20 },
        ].forEach(b => {
            draw.rect(100, b.h).fill('#268f26').move(0, b.y).opacity(0.55);
        });

        // ── Pitch markings, side-on perspective ──────────────────────
        // Goal line runs vertically at the LEFT edge (x=7). The 18-yard and
        // 6-yard boxes extend RIGHT from the goal line into the pitch. The
        // corner is at the bottom-RIGHT of the visible pitch.
        const line = '#FFFFFF';
        const lw   = 0.45;

        // Goal line (left edge of pitch)
        draw.line(7, 33, 7, 88).stroke({ color: line, width: lw, opacity: 0.65 });

        // 18-yard box — large rectangle in front of goal
        draw.line(7, 33, 55, 33).stroke({ color: line, width: lw });    // far side
        draw.line(55, 33, 55, 88).stroke({ color: line, width: lw });   // right edge
        draw.line(7, 88, 55, 88).stroke({ color: line, width: lw });    // near side

        // 6-yard box — smaller rectangle right in front of goal
        draw.line(7, 48, 25, 48).stroke({ color: line, width: lw });
        draw.line(25, 48, 25, 73).stroke({ color: line, width: lw });
        draw.line(7, 73, 25, 73).stroke({ color: line, width: lw });

        // Penalty spot — 12 yards from goal line, inside 18-yard box
        draw.circle(0.9).fill(line).center(20, 60);

        // Penalty arc — half-circle on the field side of the 18-yard box
        draw.path('M 55,55 Q 61,60 55,65').fill('none').stroke({ color: line, width: lw });

        // Corner arc — at the bottom-RIGHT corner where the taker stands
        draw.path('M 100,82 A 14 14 0 0 1 86,96').fill('none')
            .stroke({ color: line, width: 0.6 });
    }

    function drawObjects(draw, p) {
        const takerColor = p.takerColor    || p.attackColor || '#FFD700';
        const defColor   = p.defenderColor || p.defendColor || '#3B82F6';
        const gkColor    = p.gkColor       || '#39FF14';
        const ink = '#0a0a0a';

        const atk = (Array.isArray(p.attackTeam) ? p.attackTeam : []).slice().sort(() => 0.5 - Math.random());
        const def = (Array.isArray(p.defendTeam) ? p.defendTeam : []).slice().sort(() => 0.5 - Math.random());
        const takerPlayer  = atk[0] || { number: 7 };
        const boxAttackers = [atk[1] || null, atk[2] || null, atk[3] || null];
        const gkPlayer     = def.find(q => q?.position === 'GK') || def[0] || { number: 1 };
        const boxDefenders = def.filter(q => q !== gkPlayer);

        // ── Goal frame, 3/4 view on the LEFT ───────────────────────────
        // Front post at x=7 (on the goal line, closer to the camera/corner on
        // the right). Back post offset to x=2 and slightly up (y-2) to
        // suggest depth into the page.
        const goal = draw.group().opacity(0);
        // Posts
        goal.rect(0.9, 25).fill('#FFFFFF').stroke({ color: ink, width: 0.3 }).center(7, 48);
        goal.rect(0.9, 25).fill('#FFFFFF').stroke({ color: ink, width: 0.3 }).center(2, 46);
        // Crossbar (top) — connects front-top to back-top
        goal.polygon('7.5,35.5 6.5,35.5 1.5,33.5 2.5,33.5').fill('#FFFFFF').stroke({ color: ink, width: 0.3 });
        // Goal-base bar — connects front-bottom to back-bottom
        goal.polygon('7.5,60.5 6.5,60.5 1.5,58.5 2.5,58.5').fill('#FFFFFF').stroke({ color: ink, width: 0.3 });
        // Net — translucent rectangle suggesting depth
        goal.polygon('7,35.5 2,33.5 2,58.5 7,60.5').fill('rgba(255,255,255,0.10)').stroke({ color: 'rgba(255,255,255,0.35)', width: 0.25 });
        // Internal net lines for texture (interpolating between front and back faces)
        for (let i = 1; i <= 4; i++) {
            const t = i / 5;
            const yT = 35.5 + (33.5 - 35.5) * t;
            const yB = 60.5 + (58.5 - 60.5) * t;
            const xT = 7 + (2 - 7) * t;
            goal.line(xT, yT, xT, yB).stroke({ color: 'rgba(255,255,255,0.30)', width: 0.18 });
        }
        for (let i = 1; i <= 3; i++) {
            const t = i / 4;
            const y = 35.5 + (60.5 - 35.5) * t;
            const yB = 33.5 + (58.5 - 33.5) * t;
            goal.line(7, y, 2, yB).stroke({ color: 'rgba(255,255,255,0.30)', width: 0.18 });
        }
        setTimeout(() => goal.animate(400).opacity(1), 200);

        // GK in the goal mouth (between front and back posts, scaled small)
        const gk = draw.group().opacity(0);
        NS._figure(gk, 5, 56, gkPlayer, gkColor, 0.55);
        setTimeout(() => gk.animate(350).opacity(1), 400);

        // Players in the penalty area waiting for the cross — clustered between
        // the 6-yard line and the penalty spot, mix of attackers and defenders.
        // Mirrored from the old left-goal layout.
        const boxSpots = [
            { x: 40, y: 50, player: boxDefenders[0], color: defColor   },
            { x: 32, y: 58, player: boxAttackers[0], color: takerColor },
            { x: 28, y: 48, player: boxAttackers[1], color: takerColor },
            { x: 22, y: 64, player: boxDefenders[1], color: defColor   },
            { x: 18, y: 52, player: boxAttackers[2], color: takerColor },
        ];
        boxSpots.forEach((s, i) => {
            const g = draw.group().opacity(0);
            NS._figure(g, s.x, s.y, s.player, s.color, 0.55);
            setTimeout(() => g.animate(280).opacity(0.95), 500 + i * 80);
        });

        // Corner flag — planted at the corner spot (right of the taker), triangle
        // points LEFT toward the goal
        const flag = draw.group().opacity(0);
        flag.rect(0.6, 16).fill('#FFFFFF').stroke({ color: ink, width: 0.2 }).move(91.7, 78);
        flag.polygon('92,78 84,80.5 92,83').fill('#FFD700').stroke({ color: ink, width: 0.35 });
        flag.animate(350).opacity(1).delay(300);

        // Ball — at the corner spot, inside the arc
        const ball = draw.group().opacity(0);
        ball.circle(3.4).fill('white').stroke({ color: ink, width: 0.55 }).center(91, 92);
        ball.circle(0.7).fill(ink).center(90.2, 91.3);
        ball.circle(0.7).fill(ink).center(91.8, 92.6);
        setTimeout(() => ball.animate(300).opacity(1), 750);

        // Taker — foreground at the bottom-right corner, body angled toward
        // the goal (left)
        const taker = draw.group().opacity(0);
        NS._figure(taker, 78, 85, takerPlayer, takerColor, 1.5);
        setTimeout(() => taker.animate(380).opacity(1), 850);

        const caption = draw.text('CORNER KICK')
            .font({ family: 'Arial', size: 6, weight: 'bold' })
            .fill('#FFD700').stroke({ color: ink, width: 0.3 })
            .center(50, 4).opacity(0);
        setTimeout(() => caption.animate(280).opacity(1), 350);
    }

    NS.corner = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        return 2000;
    };
})(window.DramaticScenes);
