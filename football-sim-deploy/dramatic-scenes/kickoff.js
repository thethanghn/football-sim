/**
 * Kick-off scene — centre circle with two random takers from the attacking team
 * (foreground, scale 1.6), the rest of both XIs spread across their own halves
 * (background, scale 1), the ref to one side, and the ball at the centre spot.
 *
 * Split into two halves so each can evolve independently:
 *   drawBackdrop — stadium scenery + pitch + halfway line / centre circle (static)
 *   drawObjects  — flash, figures, ref, ball, caption (foreground / animated)
 *
 * Payload:
 *   - attackTeam, defendTeam: arrays of player objects (onField rosters)
 *   - attackColor, defendColor: jersey colours
 *   - minute (optional), label (optional, defaults to 'KICK OFF')
 */
(function (NS) {

    function drawBackdrop(draw) {
        const ink = '#0a0a0a';

        // Sky → stand
        const sky = draw.gradient('linear', add => {
            add.stop(0, '#0a1428');
            add.stop(1, '#1c3960');
        }).from(0, 0).to(0, 1);
        draw.rect(100, 11).fill(sky);
        draw.rect(100, 3).fill('#2a2a2a').move(0, 11);

        // Crowd — three rows of multi-coloured dots
        const crowdColors = ['#cc0000','#1133cc','#dddd00','#cc6600','#ff00ff','#00CCCC','#FFFFFF','#22C55E','#A855F7'];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 32; col++) {
                const cx = col * 3.2 + 1 + (row % 2 ? 1.6 : 0);
                const cy = 15 + row * 2.4;
                const color = crowdColors[Math.floor(Math.random() * crowdColors.length)];
                draw.circle(1.6).fill(color).stroke({ color: ink, width: 0.15 }).center(cx, cy).opacity(0.9);
            }
        }

        // Hoarding (barrier + white panel + advert blocks)
        draw.rect(100, 1.4).fill('#444').move(0, 23);
        draw.rect(100, 1.6).fill('#FFFFFF').move(0, 24.4).opacity(0.85);
        for (let i = 0; i < 5; i++) {
            const adv = crowdColors[Math.floor(Math.random() * crowdColors.length)];
            draw.rect(18, 1.6).fill(adv).move(i * 20, 24.5).opacity(0.45);
        }

        // Touchline
        draw.rect(100, 0.5).fill('#FFFFFF').move(0, 26);

        // Pitch — opaque green + perspective mowing stripes
        draw.rect(100, 74).fill('#1a7a1a').move(0, 26.5);
        [
            { y: 28, h: 5 }, { y: 40, h: 8 }, { y: 60, h: 14 },
        ].forEach(b => {
            draw.rect(100, b.h).fill('#268f26').move(0, b.y).opacity(0.55);
        });

        // Pitch markings — halfway line + centre circle (perspective ellipse) + spot
        draw.line(0, 56, 100, 56).stroke({ color: '#FFFFFF', width: 0.6 });
        draw.ellipse(46, 16).center(50, 56).fill('none').stroke({ color: '#FFFFFF', width: 0.6 });
        draw.circle(0.9).fill('#FFFFFF').center(50, 56);
    }

    function drawObjects(draw, p) {
        const attackTeam = Array.isArray(p.attackTeam) ? p.attackTeam : [];
        const defendTeam = Array.isArray(p.defendTeam) ? p.defendTeam : [];
        const takerColor = p.attackColor || p.takerColor || '#FFD700';
        const altColor   = p.defendColor || p.altColor   || '#3B82F6';
        const ink = '#0a0a0a';

        // Pick distinct random players for each slot.
        const shuffled = arr => arr.slice().sort(() => 0.5 - Math.random());
        const atk = shuffled(attackTeam);
        const def = shuffled(defendTeam);
        const takerL = atk[0] || null;
        const takerR = atk[1] || null;
        const atkOthers = atk.slice(2, 7);
        const defOthers = def.slice(0, 5);

        // Opening flash + rings — flagged with the attacking team's colour
        NS._flashAndRings(draw, takerColor);

        // Background players: attackers in own half, defenders in own half
        const atkSpots = [
            { x: 22, y: 70 }, { x: 78, y: 70 },
            { x: 35, y: 82 }, { x: 65, y: 82 },
            { x: 18, y: 90 },
        ];
        const defSpots = [
            { x: 30, y: 44 }, { x: 70, y: 44 },
            { x: 50, y: 38 }, { x: 14, y: 34 }, { x: 86, y: 34 },
        ];

        const others = [
            ...atkSpots.map((s, i) => ({ ...s, player: atkOthers[i], color: takerColor })),
            ...defSpots.map((s, i) => ({ ...s, player: defOthers[i], color: altColor })),
        ];
        others.forEach((o, i) => {
            const g = draw.group().opacity(0);
            NS._figure(g, o.x, o.y, o.player, o.color, 1);
            setTimeout(() => g.animate(260).opacity(0.95), 420 + i * 50);
        });

        // Referee (off to the side of the centre spot, with whistle)
        const ref = draw.group().opacity(0);
        ref.rect(4.5, 8).fill('#000000').stroke({ color: ink, width: 0.35 }).center(72, 58).radius(0.5);
        ref.circle(2.6).fill('#F5CBA7').stroke({ color: ink, width: 0.3 }).center(72, 53);
        ref.rect(1.4, 5).fill('#1f1f1f').stroke({ color: ink, width: 0.2 }).center(71, 64);
        ref.rect(1.4, 5).fill('#1f1f1f').stroke({ color: ink, width: 0.2 }).center(73, 64);
        ref.circle(1).fill('#C0C0C0').stroke({ color: ink, width: 0.25 }).center(73.6, 53);
        setTimeout(() => ref.animate(300).opacity(1), 650);

        // Two takers over the ball at the centre spot (foreground, bigger)
        const takerLeft = draw.group().opacity(0);
        NS._figure(takerLeft, 46.2, 62, takerL, takerColor, 1.6);
        setTimeout(() => takerLeft.animate(350).opacity(1), 820);

        const takerRight = draw.group().opacity(0);
        NS._figure(takerRight, 53.8, 62, takerR, takerColor, 1.6);
        setTimeout(() => takerRight.animate(350).opacity(1), 900);

        // Ball at the centre spot, between the takers' feet
        const ball = draw.group().opacity(0);
        ball.circle(3).fill('white').stroke({ color: ink, width: 0.45 }).center(50, 72);
        ball.circle(0.6).fill(ink).center(49.3, 71.4);
        ball.circle(0.6).fill(ink).center(50.7, 72.5);
        setTimeout(() => ball.animate(280).opacity(1), 1050);

        // Caption
        const caption = draw.text(p.label || 'KICK OFF')
            .font({ family: 'Arial', size: 7, weight: 'bold' })
            .fill('#FFD700').stroke({ color: ink, width: 0.3 })
            .center(50, 7).opacity(0);
        setTimeout(() => caption.animate(280).opacity(1), 350);

        if (p.minute != null) {
            const sub = draw.text(`${p.minute}'`)
                .font({ family: 'Arial', size: 4 })
                .fill('white').stroke({ color: ink, width: 0.15 })
                .center(50, 96).opacity(0);
            setTimeout(() => sub.animate(280).opacity(1), 500);
        }
    }

    NS.kickoff = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        return 2200;
    };
})(window.DramaticScenes);
