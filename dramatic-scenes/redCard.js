/**
 * Red card scene — dim wash, the card rotating in, with header
 * (RED CARD or SECOND YELLOW) and the player name + minute below.
 */
(function (NS) {

    function drawBackdrop(draw) {
        NS._dimBackdrop(draw, { color: '#000', opacity: 0.55, fadeMs: 250 });
    }

    function drawObjects(draw, p) {
        const ink = '#0a0a0a';

        const card = draw.rect(22, 30).fill('#DC2626')
            .stroke({ color: ink, width: 0.8 })
            .center(50, 42);
        card.transform({ rotate: -25, scale: 0 });
        card.animate(500).transform({ rotate: -10, scale: 1 });

        const header = draw.text(p.kind === 'second' ? 'SECOND YELLOW' : 'RED CARD')
            .font({ family: 'Arial', size: 8, weight: 'bold' })
            .fill('white')
            .center(50, 76).opacity(0);
        setTimeout(() => header.animate(300).opacity(1), 350);

        if (p.name) {
            const text = `${p.name}${p.minute ? '  ·  ' + p.minute + "'" : ''}`;
            const badge = NS._nameBadge(draw, text, 50, 88, {
                fontSize: 5,
                borderColor: '#DC2626',   // match the red-card tone
            });
            badge.opacity(0);
            setTimeout(() => badge.animate(300).opacity(1), 600);
        }
    }

    NS.redCard = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        return 2100;
    };
})(window.DramaticScenes);
