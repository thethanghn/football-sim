/**
 * Injury scene — grey wash, red cross fades in, INJURY label + player name.
 */
(function (NS) {

    function drawBackdrop(draw) {
        NS._dimBackdrop(draw, { color: '#444', opacity: 0.50, fadeMs: 400 });
    }

    function drawObjects(draw, p) {
        const ink = '#0a0a0a';

        const cx = 50, cy = 45;
        const horiz = draw.rect(18, 4.5).fill('#EF4444')
            .stroke({ color: ink, width: 0.4 }).center(cx, cy).opacity(0);
        const vert  = draw.rect(4.5, 18).fill('#EF4444')
            .stroke({ color: ink, width: 0.4 }).center(cx, cy).opacity(0);
        setTimeout(() => {
            horiz.animate(500).opacity(0.95);
            vert.animate(500).opacity(0.95);
        }, 200);

        const text = draw.text('INJURY')
            .font({ family: 'Arial', size: 7, weight: 'bold' })
            .fill('white').center(50, 65).opacity(0);
        setTimeout(() => text.animate(300).opacity(1), 700);

        if (p.name) {
            const text = `${p.name}${p.minute ? '  ·  ' + p.minute + "'" : ''}`;
            const badge = NS._nameBadge(draw, text, 50, 78, {
                fontSize: 5,
                borderColor: '#EF4444',   // matches the red cross
            });
            badge.opacity(0);
            setTimeout(() => badge.animate(300).opacity(1), 950);
        }
    }

    NS.injury = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        return 2400;
    };
})(window.DramaticScenes);
