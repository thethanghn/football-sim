/**
 * DramaticScenes namespace + shared building blocks used across scene files.
 *
 * Each scene file in this folder attaches a single function to `window.DramaticScenes`,
 * keyed by the kind passed to `DramaticOverlay.play(kind, payload)`.
 *
 * Loaded by football-sim.html before any individual scene file — the scenes
 * reference `DramaticScenes._flashAndRings`, `_figure`, and `_avatarDataUri`.
 */
window.DramaticScenes = window.DramaticScenes || {};

(function (NS) {

    // Full-screen rect that fades in to a target opacity. Used as the backdrop
    // for the text-driven scenes (red card, disallowed, penalty, injury) so the
    // foreground text + glyphs pop against a uniform wash.
    NS._dimBackdrop = function (draw, { color = '#000', opacity = 0.45, fadeMs = 200 } = {}) {
        const dim = draw.rect(100, 100).fill(color).opacity(0);
        dim.animate(fadeMs).opacity(opacity);
        return dim;
    };

    // Returns a group containing a rounded dark "name badge" — a high-contrast
    // pill behind bold white text. Used by the player-name sub-lines in red
    // card / injury / penalty scenes so the name reads cleanly on top of dim
    // overlays or pitch backdrops.
    //
    // Width is approximated from character count; tweak `charWidth` if a custom
    // font is needed. Returns the group so the caller can fade / animate it.
    NS._nameBadge = function (parent, text, cx, cy, opts = {}) {
        const o = {
            fontSize:    4.5,
            textColor:   '#FFFFFF',
            bgColor:     'rgba(0,0,0,0.82)',
            borderColor: '#FFD700',
            borderWidth: 0.35,
            padding:     1.8,
            charWidth:   0.55,
            ...opts,
        };
        const w = Math.max(8, text.length * o.fontSize * o.charWidth + o.padding * 2);
        const h = o.fontSize + o.padding * 1.5;

        const badge = parent.group();
        badge.rect(w, h).fill(o.bgColor).stroke({ color: o.borderColor, width: o.borderWidth })
            .radius(1.2).center(cx, cy);
        badge.text(text)
            .font({ family: 'Arial', size: o.fontSize, weight: 'bold' })
            .fill(o.textColor)
            .center(cx, cy);
        return badge;
    };

    // Full-screen white flash that fades out, plus three staggered expanding rings.
    // Used by the goal, free-kick, and kick-off scenes for a high-energy opening beat.
    NS._flashAndRings = function (draw, ringColor = '#FFD700') {
        const flash = draw.rect(100, 100).fill('white').opacity(0.6);
        flash.animate(500).opacity(0);

        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const ring = draw.circle(0).center(50, 50)
                    .fill('none').stroke({ color: ringColor, width: 1.4 }).opacity(0.85);
                ring.animate(1200).radius(55).opacity(0);
                setTimeout(() => { try { ring.remove(); } catch (e) {} }, 1300);
            }, i * 180);
        }
    };

    // Encodes the avatar's human figure as a data: URI we can drop into an SVG <image>.
    // Prefers the transparent figure-only renderer (createFigureSVG) so embeds don't drag
    // the sky-blue card background onto the pitch; falls back to the full card if not
    // available. utf-8 safe. Returns null if there's no avatar to render.
    NS._avatarDataUri = function (player, jerseyColor) {
        if (!player?.avatar || typeof AvatarGenerator === 'undefined') return null;
        try {
            const render = AvatarGenerator.createFigureSVG || AvatarGenerator.createSVG;
            const markup = render.call(AvatarGenerator, player.avatar, 100, jerseyColor);
            return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
        } catch (e) {
            return null;
        }
    };

    // Draws a stylised football player at (x, y) — head with real avatar face,
    // neck, V-neck shirt with shaped sleeves, exposed skin arms + hands, dark
    // shorts, exposed calves, and boots. Body width adapts to the avatar's
    // `build` (slim / athletic / stocky). Skin tone comes from the avatar so
    // arms / hands / calves match the face.
    //
    // `scale` ≈ 1 for background players, ≈ 1.6 for foreground takers.
    // `gesture` controls the arms+hands pose: 'default' (hanging at sides),
    //          'spread' (arms wide — GK ready), 'hips' (hands on hips),
    //          'onHead' (hands on head — anxious pose).
    // Total figure span at scale 1 ≈ 14 units vertical, ~5 units wide.
    NS._figure = function (g, x, y, player, jerseyColor, scale = 1, gesture = 'default') {
        const ink   = '#0a0a0a';
        const skin  = player?.avatar?.skin  || '#F5CBA7';
        const build = player?.avatar?.build || 'athletic';
        const num   = player?.number != null ? String(player.number) : '';
        const s     = scale;

        // ── Build-aware torso widths ────────────────────────────────────
        // Shoulder is ~22% wider than waist for a tapered torso silhouette.
        const baseW        = build === 'slim' ? 3.2 : build === 'stocky' ? 4.2 : 3.6;
        const halfShoulder = baseW * s * 0.55;
        const halfWaist    = baseW * s * 0.45;

        // ── Y-axis landmarks (top → bottom) ─────────────────────────────
        // headY = ellipse-clip center for the avatar head+hair region. The
        // chin lands at headY + headH/2; we align that to neckTop so the
        // jawline meets the top of the neck smoothly.
        const headH       = 5.6 * s;         // bigger head for chibi-ish proportions
        const headW       = 4.8 * s;
        const neckTop     = y - 2.9 * s;
        const headY       = neckTop - headH / 2 + 0.2 * s;   // chin ≈ neckTop
        const shoulderY   = y - 2.0 * s;
        const waistY      = y + 2.0 * s;
        const shortsBot   = y + 4.0 * s;
        const calfTop     = y + 2.5 * s;     // extends up so shorts overlap on top
        const calfBot     = y + 5.5 * s;     // shorter legs — compact silhouette
        const bootY       = y + 6.0 * s;

        // ── X-axis landmarks ────────────────────────────────────────────
        const legHalf  = 0.9 * s;
        const armX_L   = x - halfShoulder - 0.1 * s;
        const armX_R   = x + halfShoulder + 0.1 * s;

        // ── 1. Calves (skin) — drawn first; shorts overlap their top ────
        g.rect(1.3 * s, calfBot - calfTop).fill(skin).stroke({ color: ink, width: 0.2 })
            .move(x - legHalf - 0.65 * s, calfTop).radius(0.3 * s);
        g.rect(1.3 * s, calfBot - calfTop).fill(skin).stroke({ color: ink, width: 0.2 })
            .move(x + legHalf - 0.65 * s, calfTop).radius(0.3 * s);

        // ── 2. Boots (dark elongated ovals at the feet) ─────────────────
        g.ellipse(2.3 * s, 1.3 * s).fill(ink).center(x - legHalf, bootY);
        g.ellipse(2.3 * s, 1.3 * s).fill(ink).center(x + legHalf, bootY);

        // ── 3. Shorts (dark trapezoid, widens slightly toward knees) ────
        g.polygon(
            `${x - halfWaist},${waistY} ${x + halfWaist},${waistY} ` +
            `${x + halfWaist + 0.3 * s},${shortsBot} ${x - halfWaist - 0.3 * s},${shortsBot}`
        ).fill('#1a1a1a').stroke({ color: ink, width: 0.25 });
        g.line(x, waistY + 0.3 * s, x, shortsBot).stroke({ color: ink, width: 0.2, opacity: 0.6 });

        // ── 4 + 5. Arms + hands (gesture-aware) ─────────────────────────
        const armFill = { color: ink, width: 0.2 };
        if (gesture === 'spread') {
            // GK pose — arms horizontal, ready to dive either way
            g.rect(3.2 * s, 1.0 * s).fill(skin).stroke(armFill)
                .move(armX_L - 3.2 * s, shoulderY + 0.4 * s).radius(0.3 * s);
            g.rect(3.2 * s, 1.0 * s).fill(skin).stroke(armFill)
                .move(armX_R, shoulderY + 0.4 * s).radius(0.3 * s);
            g.circle(1.1 * s).fill(skin).stroke(armFill).center(armX_L - 3.2 * s, shoulderY + 0.9 * s);
            g.circle(1.1 * s).fill(skin).stroke(armFill).center(armX_R + 3.2 * s, shoulderY + 0.9 * s);
        } else if (gesture === 'hips') {
            // Hands on hips — arms bent at elbow, hands at waist (akimbo)
            g.polygon(
                `${armX_L - 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${armX_L + 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${x - halfWaist + 0.4 * s},${waistY - 0.3 * s} ` +
                `${x - halfWaist - 0.8 * s},${waistY + 0.3 * s}`
            ).fill(skin).stroke(armFill);
            g.polygon(
                `${armX_R - 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${armX_R + 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${x + halfWaist + 0.8 * s},${waistY + 0.3 * s} ` +
                `${x + halfWaist - 0.4 * s},${waistY - 0.3 * s}`
            ).fill(skin).stroke(armFill);
            g.circle(1.0 * s).fill(skin).stroke(armFill).center(x - halfWaist + 0.1 * s, waistY);
            g.circle(1.0 * s).fill(skin).stroke(armFill).center(x + halfWaist - 0.1 * s, waistY);
        } else if (gesture === 'onHead') {
            // Hands on head — arms go up, anxious pose
            g.polygon(
                `${armX_L - 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${armX_L + 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${x - 2.0 * s + 0.5 * s},${headY + 0.5 * s} ` +
                `${x - 2.0 * s - 0.5 * s},${headY + 0.5 * s}`
            ).fill(skin).stroke(armFill);
            g.polygon(
                `${armX_R - 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${armX_R + 0.5 * s},${shoulderY + 0.2 * s} ` +
                `${x + 2.0 * s + 0.5 * s},${headY + 0.5 * s} ` +
                `${x + 2.0 * s - 0.5 * s},${headY + 0.5 * s}`
            ).fill(skin).stroke(armFill);
            g.circle(1.0 * s).fill(skin).stroke(armFill).center(x - 2.0 * s, headY + 0.5 * s);
            g.circle(1.0 * s).fill(skin).stroke(armFill).center(x + 2.0 * s, headY + 0.5 * s);
        } else {
            // Default — arms hanging at sides
            g.rect(1.0 * s, 4 * s).fill(skin).stroke(armFill)
                .move(armX_L - 0.5 * s, shoulderY + 0.3 * s).radius(0.3 * s);
            g.rect(1.0 * s, 4 * s).fill(skin).stroke(armFill)
                .move(armX_R - 0.5 * s, shoulderY + 0.3 * s).radius(0.3 * s);
            g.circle(1.1 * s).fill(skin).stroke(armFill).center(armX_L, shoulderY + 4.8 * s);
            g.circle(1.1 * s).fill(skin).stroke(armFill).center(armX_R, shoulderY + 4.8 * s);
        }

        // ── 6. Shirt body (tapered torso polygon) ───────────────────────
        g.polygon(
            `${x - halfShoulder},${shoulderY} ${x + halfShoulder},${shoulderY} ` +
            `${x + halfWaist},${waistY} ${x - halfWaist},${waistY}`
        ).fill(jerseyColor).stroke({ color: ink, width: 0.3 });

        // ── 7. Short sleeves (cover the top of each arm) ────────────────
        g.polygon(
            `${x - halfShoulder + 0.1 * s},${shoulderY} ` +
            `${x - halfShoulder - 0.7 * s},${shoulderY + 0.3 * s} ` +
            `${x - halfShoulder - 0.5 * s},${shoulderY + 2 * s} ` +
            `${x - halfShoulder + 0.6 * s},${shoulderY + 1.8 * s}`
        ).fill(jerseyColor).stroke({ color: ink, width: 0.25 });
        g.polygon(
            `${x + halfShoulder - 0.1 * s},${shoulderY} ` +
            `${x + halfShoulder + 0.7 * s},${shoulderY + 0.3 * s} ` +
            `${x + halfShoulder + 0.5 * s},${shoulderY + 2 * s} ` +
            `${x + halfShoulder - 0.6 * s},${shoulderY + 1.8 * s}`
        ).fill(jerseyColor).stroke({ color: ink, width: 0.25 });

        // ── 8. V-neck cutout (skin showing through the collar) ──────────
        g.polygon(
            `${x - 0.7 * s},${shoulderY} ${x + 0.7 * s},${shoulderY} ` +
            `${x + 0.25 * s},${shoulderY + 1.1 * s} ${x - 0.25 * s},${shoulderY + 1.1 * s}`
        ).fill(skin);

        // ── 9. Shirt number on the chest ────────────────────────────────
        if (num) {
            g.text(num).font({ family: 'Arial', size: 1.7 * s, weight: 'bold' })
                .fill('white').stroke({ color: ink, width: 0.18, opacity: 0.5 })
                .center(x, y + 0.2 * s);
        }

        // ── 10. Neck (small skin trapezoid between shoulders and head) ──
        g.polygon(
            `${x - 0.85 * s},${shoulderY} ${x + 0.85 * s},${shoulderY} ` +
            `${x + 0.55 * s},${neckTop} ${x - 0.55 * s},${neckTop}`
        ).fill(skin).stroke({ color: ink, width: 0.2 });

        // ── 11. Head: avatar face + hair, ellipse-clipped ───────────────
        // The avatar viewbox positions the head ellipse at (50, 37) but
        // hair extends WAY above that: mohawk tips touch viewbox y≈4,
        // afro spreads to y≈1, spiky to y≈1. A simple circle clip around
        // (50, 37) sliced all that off — so we use a taller ellipse clip
        // centered at viewbox (50, 30): rx 24 covers ears + wide afros,
        // ry 28 covers hair top down to chin (y≈58).
        const uri = NS._avatarDataUri(player, jerseyColor);
        if (uri) {
            const VBX_CY = 30, VBX_RX = 24, VBX_RY = 28;
            const W = headH * 100 / (2 * VBX_RY);    // image width sized so clip-height = headH
            const ix = x - W / 2;
            const iy = headY - VBX_CY * W / 100;
            const img = g.image(uri).size(W, W).move(ix, iy);

            const clipW = 2 * VBX_RX * W / 100;
            const clipH = 2 * VBX_RY * W / 100;
            const clip  = g.ellipse(clipW, clipH).center(x, headY);
            img.clipWith(clip);
            // No outline — the avatar's own head/hair edges read cleanly against
            // the pitch and the ink ellipse looked like a "halo" around heads.
        } else {
            g.ellipse(headW, headH).fill(skin).stroke({ color: ink, width: 0.25 }).center(x, headY);
        }
    };

    // Same anatomy as `_figure` but drawn from BEHIND — no face features, the
    // head is a hair-coloured silhouette, the shirt back carries a LARGE shirt
    // number (no V-neck cutout), and the player's surname sits above the number.
    // Used for the corner-kick taker in the foreground where the camera is
    // looking over the player's shoulder.
    NS._backFigure = function (g, x, y, player, jerseyColor, scale = 1) {
        const ink   = '#0a0a0a';
        const skin  = player?.avatar?.skin  || '#F5CBA7';
        const hair  = player?.avatar?.hair  || '#1a1a1a';
        const hairStyle = player?.avatar?.hairStyle || 'short';
        const build = player?.avatar?.build || 'athletic';
        const num   = player?.number != null ? String(player.number) : '';
        const nameLast = (player?.name || '').split(' ').pop().toUpperCase();
        const s     = scale;

        const baseW = build === 'slim' ? 3.2 : build === 'stocky' ? 4.2 : 3.6;
        const halfShoulder = baseW * s * 0.55;
        const halfWaist    = baseW * s * 0.45;

        const headH     = 5.6 * s;
        const headW     = 4.8 * s;
        const neckTop   = y - 2.9 * s;
        const headY     = neckTop - headH / 2 + 0.2 * s;
        const shoulderY = y - 2.0 * s;
        const waistY    = y + 2.0 * s;
        const shortsBot = y + 4.0 * s;
        const calfTop   = y + 2.5 * s;
        const calfBot   = y + 5.5 * s;
        const bootY     = y + 6.0 * s;

        const legHalf = 0.9 * s;
        const armX_L  = x - halfShoulder - 0.1 * s;
        const armX_R  = x + halfShoulder + 0.1 * s;

        // Calves
        g.rect(1.3 * s, calfBot - calfTop).fill(skin).stroke({ color: ink, width: 0.2 })
            .move(x - legHalf - 0.65 * s, calfTop).radius(0.3 * s);
        g.rect(1.3 * s, calfBot - calfTop).fill(skin).stroke({ color: ink, width: 0.2 })
            .move(x + legHalf - 0.65 * s, calfTop).radius(0.3 * s);

        // Boots
        g.ellipse(2.3 * s, 1.3 * s).fill(ink).center(x - legHalf, bootY);
        g.ellipse(2.3 * s, 1.3 * s).fill(ink).center(x + legHalf, bootY);

        // Shorts
        g.polygon(
            `${x - halfWaist},${waistY} ${x + halfWaist},${waistY} ` +
            `${x + halfWaist + 0.3 * s},${shortsBot} ${x - halfWaist - 0.3 * s},${shortsBot}`
        ).fill('#1a1a1a').stroke({ color: ink, width: 0.25 });
        g.line(x, waistY + 0.3 * s, x, shortsBot).stroke({ color: ink, width: 0.2, opacity: 0.6 });

        // Arms + hands
        g.rect(1.0 * s, 4 * s).fill(skin).stroke({ color: ink, width: 0.2 })
            .move(armX_L - 0.5 * s, shoulderY + 0.3 * s).radius(0.3 * s);
        g.rect(1.0 * s, 4 * s).fill(skin).stroke({ color: ink, width: 0.2 })
            .move(armX_R - 0.5 * s, shoulderY + 0.3 * s).radius(0.3 * s);
        g.circle(1.1 * s).fill(skin).stroke({ color: ink, width: 0.2 })
            .center(armX_L, shoulderY + 4.8 * s);
        g.circle(1.1 * s).fill(skin).stroke({ color: ink, width: 0.2 })
            .center(armX_R, shoulderY + 4.8 * s);

        // Shirt back — solid, no V-neck cutout
        g.polygon(
            `${x - halfShoulder},${shoulderY} ${x + halfShoulder},${shoulderY} ` +
            `${x + halfWaist},${waistY} ${x - halfWaist},${waistY}`
        ).fill(jerseyColor).stroke({ color: ink, width: 0.3 });

        // Sleeves (cover top of arms)
        g.polygon(
            `${x - halfShoulder + 0.1 * s},${shoulderY} ` +
            `${x - halfShoulder - 0.7 * s},${shoulderY + 0.3 * s} ` +
            `${x - halfShoulder - 0.5 * s},${shoulderY + 2 * s} ` +
            `${x - halfShoulder + 0.6 * s},${shoulderY + 1.8 * s}`
        ).fill(jerseyColor).stroke({ color: ink, width: 0.25 });
        g.polygon(
            `${x + halfShoulder - 0.1 * s},${shoulderY} ` +
            `${x + halfShoulder + 0.7 * s},${shoulderY + 0.3 * s} ` +
            `${x + halfShoulder + 0.5 * s},${shoulderY + 2 * s} ` +
            `${x + halfShoulder - 0.6 * s},${shoulderY + 1.8 * s}`
        ).fill(jerseyColor).stroke({ color: ink, width: 0.25 });

        // Surname on the back, above the number
        if (nameLast) {
            g.text(nameLast).font({ family: 'Arial', size: 0.9 * s, weight: 'bold' })
                .fill('white').stroke({ color: ink, width: 0.1, opacity: 0.7 })
                .center(x, y - 1.1 * s);
        }

        // Large shirt number on the back
        if (num) {
            g.text(num).font({ family: 'Arial', size: 2.6 * s, weight: 'bold' })
                .fill('white').stroke({ color: ink, width: 0.3, opacity: 0.6 })
                .center(x, y + 0.4 * s);
        }

        // Back of neck
        g.polygon(
            `${x - 0.85 * s},${shoulderY} ${x + 0.85 * s},${shoulderY} ` +
            `${x + 0.55 * s},${neckTop} ${x - 0.55 * s},${neckTop}`
        ).fill(skin).stroke({ color: ink, width: 0.2 });

        // Back of head — hairstyle-aware solid silhouette
        if (hairStyle === 'bald') {
            g.ellipse(headW, headH).fill(skin).stroke({ color: ink, width: 0.3 }).center(x, headY);
        } else if (hairStyle === 'afro') {
            g.ellipse(headW * 1.25, headH * 1.1).fill(hair).stroke({ color: ink, width: 0.3 }).center(x, headY - 0.3 * s);
        } else if (hairStyle === 'mohawk') {
            g.ellipse(headW, headH).fill(skin).stroke({ color: ink, width: 0.3 }).center(x, headY);
            g.rect(0.9 * s, headH * 1.15).fill(hair).stroke({ color: ink, width: 0.2 })
                .center(x, headY - 0.3 * s).radius(0.2 * s);
        } else {
            g.ellipse(headW, headH).fill(hair).stroke({ color: ink, width: 0.3 }).center(x, headY);
        }
    };

})(window.DramaticScenes);
