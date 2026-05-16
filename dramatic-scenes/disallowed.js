/**
 * Goal disallowed scene — dim wash, rotated GOAL DISALLOWED stamp,
 * with the reason (offside / handball / foul) underneath.
 */
(function (NS) {

    function drawBackdrop(draw) {
        NS._dimBackdrop(draw, { color: '#000', opacity: 0.45, fadeMs: 200 });
    }

    function drawObjects(draw, p) {
        const ink = '#0a0a0a';

        const stamp = draw.text('GOAL DISALLOWED')
            .font({ family: 'Arial', size: 10, weight: 'bold' })
            .fill('#EF4444').stroke({ color: ink, width: 0.5 })
            .center(50, 48);
        stamp.transform({ rotate: -12, scale: 0 });
        stamp.animate(500).transform({ rotate: -12, scale: 1 });

        if (p.reason) {
            const sub = draw.text(p.reason.toUpperCase())
                .font({ family: 'Arial', size: 6, weight: 'bold' })
                .fill('white').stroke({ color: ink, width: 0.2 })
                .center(50, 60).opacity(0);
            setTimeout(() => sub.animate(300).opacity(1), 400);
        }
    }

    NS.disallowed = function (draw, p) {
        drawBackdrop(draw);
        drawObjects(draw, p);
        return 1900;
    };
})(window.DramaticScenes);
