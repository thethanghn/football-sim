/**
 * DramaticOverlay — orchestrates short animated SVG scenes that play over the pitch
 * view on critical-tier events (red card, disallowed goal, penalty award, stretchered
 * injury, goal, free kick, corner). Built with SVG.js — the existing rendering layer.
 *
 * Mounted into #dramaticOverlay inside .pitch-container, sandwiched between
 * the Phaser canvas (z-index 0) and the celebration screen (z-index 10).
 *
 * Usage:
 *   sim.dramatic.play('redCard', { name: 'Smith', minute: 62 });
 *
 * Pauses the simulator for the duration so events don't fire during the clip.
 *
 * The actual artwork lives in the `dramatic-scenes/` folder — one file per scene,
 * each attaching its function to `window.DramaticScenes`. This class is just the
 * mount/unmount, pause handling, and dispatcher.
 */
class DramaticOverlay {
    constructor(sim) {
        this.sim = sim;
        this.host = null;
        this.active = false;
    }

    play(kind, payload = {}) {
        if (this.active) return;
        const host = document.getElementById('dramaticOverlay');
        if (!host || typeof SVG === 'undefined') return;
        host.innerHTML = '';
        host.style.display = 'block';
        this.host = host;
        this.active = true;

        // Pause the simulator for the duration so we don't race against new events.
        const wasPaused = this.sim?.isPaused;
        if (this.sim) this.sim.isPaused = true;

        const draw = SVG().addTo(host).size('100%', '100%').viewbox(0, 0, 100, 100);

        let duration = 1800;
        try {
            const fn = (typeof DramaticScenes !== 'undefined') ? DramaticScenes[kind] : null;
            if (typeof fn === 'function') {
                duration = fn(draw, payload) || 1800;
            } else {
                duration = 600;
            }
        } catch (e) {
            console.warn('DramaticOverlay play failed:', e);
            duration = 100;
        }

        setTimeout(() => {
            try { draw.remove(); } catch (e) {}
            host.style.display = 'none';
            this.active = false;
            // Only un-pause if WE paused, and don't override user-initiated state
            // (manual pause, kickoff pause, or the Management Panel being open).
            if (this.sim && !wasPaused && !this.sim._managementOpen) {
                this.sim.isPaused = false;
            }
        }, duration);
    }

    isActive() { return this.active; }
}
