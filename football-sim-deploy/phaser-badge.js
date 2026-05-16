/**
 * Minimal Phaser integration demo.
 *
 * Renders a small spinning football into #phaserBadge in the top-right of the page.
 * Lives in its own file so the Phaser dependency doesn't leak into the rest of the app —
 * the match engine, the renderer, and game-flow.js have no knowledge of Phaser.
 *
 * This is intentionally a tiny canvas (40×40 px) — its purpose is to prove the library is
 * integrated and ready, not to replace any existing rendering. The bigger match-pitch port
 * (where Phaser could meaningfully add value) is a separate piece of work.
 */
(function () {
    function start() {
        if (typeof Phaser === 'undefined') return;
        const target = document.getElementById('phaserBadge');
        if (!target) return;

        // Avoid double-init on hot reloads.
        if (target.dataset.phaserMounted === '1') return;
        target.dataset.phaserMounted = '1';

        new Phaser.Game({
            type: Phaser.AUTO,
            width: 40,
            height: 40,
            parent: target,
            transparent: true,
            scene: {
                create() {
                    const cx = 20, cy = 20, r = 14;

                    // Container — the spinning element. Children rotate together.
                    const ball = this.add.container(cx, cy);

                    // White ball with black outline
                    const body = this.add.circle(0, 0, r, 0xFFFFFF);
                    body.setStrokeStyle(1.5, 0x000000);
                    ball.add(body);

                    // Five pentagon-pattern spots
                    for (let i = 0; i < 5; i++) {
                        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
                        const spot = this.add.circle(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 2.2, 0x111111);
                        ball.add(spot);
                    }
                    // Centre spot
                    ball.add(this.add.circle(0, 0, 1.6, 0x111111));

                    // Loop a slow rotation
                    this.tweens.add({
                        targets: ball,
                        angle: 360,
                        duration: 5000,
                        repeat: -1,
                        ease: 'Linear',
                    });
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
