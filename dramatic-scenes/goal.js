/**
 * Goal scene — brief flash + expanding rings; the celebration screen takes over
 * for the rest of the post-goal sequence.
 */
(function (NS) {
    NS.goal = function (draw, p) {
        const ringColor = p.color || '#FFD700';
        NS._flashAndRings(draw, ringColor);
        return 900;
    };
})(window.DramaticScenes);
