/**
 * Zone-strength calculations extracted from FootballSimulator.
 *
 * Two independent models live here:
 *
 *   1. `bandRatings(team, formation)` → { attack, midfield, defense }
 *      The 3-band model the match engine actually reads. Players are binned
 *      by their position label into one of three buckets, a position-specific
 *      attribute formula gives each player a rating, the bucket average is
 *      taken, then multiplied by a formation bonus.
 *
 *   2. `gridStrengths({...})` → array of { player, cpu } for a `bands × lanes` grid
 *      The fine-grained spatial view used by the debug overlay. Each onfield
 *      player has a circular "influence radius"; their position-weighted overall
 *      (× stamina) is spread over every cell within that radius with linear
 *      falloff, and the cell's reported strength is the SUM of contributions —
 *      so more nearby players = higher number.
 *
 * No DOM dependencies. Pure functions, side-effect free.
 */
class ZoneStrength {
    static FORMATION_BONUSES = {
        '442': { attack: 1.00, midfield: 1.00, defense: 1.00 },
        '433': { attack: 1.10, midfield: 0.95, defense: 0.95 },
        '451': { attack: 0.92, midfield: 1.18, defense: 1.00 },
        '532': { attack: 0.90, midfield: 1.00, defense: 1.10 },
        '541': { attack: 0.82, midfield: 1.05, defense: 1.20 },
        '352': { attack: 1.05, midfield: 1.12, defense: 0.88 },
        '343': { attack: 1.12, midfield: 1.05, defense: 0.88 },
    };

    static ATTACK_POS  = ['ST', 'CF', 'LW', 'RW', 'CAM'];
    static MID_POS     = ['CM', 'CDM', 'LM', 'RM'];
    static DEFENSE_POS = ['CB', 'LB', 'RB', 'LWB', 'RWB'];

    static formationBonus(formation) {
        return ZoneStrength.FORMATION_BONUSES[formation] || ZoneStrength.FORMATION_BONUSES['442'];
    }

    // Per-player fatigue multiplier — determination softens the penalty so a
    // tired but determined player still contributes more than a tired one without it.
    static fatigueMult(player) {
        const sf  = Math.max(0.5, (player.stamina || 80) / 100);
        const det = (player.determination || 70) / 100;
        return sf + (1 - sf) * det * 0.5;
    }

    // PES-style match-day morale multiplier. Applied on top of fatigue.
    // top ↑ +10 %, good ↗ +5 %, normal → 0 %, poor ↘ −5 %, terrible ↓ −12 %.
    static moraleMult(player) {
        return ({
            top:      1.10,
            good:     1.05,
            normal:   1.00,
            poor:     0.95,
            terrible: 0.88,
        })[player.morale] ?? 1.0;
    }

    // Position families — drives the "same family but not secondary" middle tier.
    static POSITION_FAMILY = {
        GK:  'gk',
        CB:  'centre-back',   CDM: 'centre-back',
        LB:  'fullback',      RB:  'fullback',
        LWB: 'fullback',      RWB: 'fullback',
        CM:  'central-mid',   CAM: 'central-mid',
        LM:  'wide',          RM:  'wide',
        LW:  'wide',          RW:  'wide',
        ST:  'striker',       CF:  'striker',
    };

    // CM/PES-style out-of-position penalty. Returns 0.50–1.00 based on how well the
    // player's natural + secondary positions cover the position they're currently playing.
    static positionMult(player) {
        const natural = player.naturalPosition;
        const playing = player.position;
        if (!natural || !playing || natural === playing) return 1.00;            // 1.00 — natural
        if ((player.secondaryPositions || []).includes(playing)) return 0.88;    // 0.88 — secondary
        const fam = ZoneStrength.POSITION_FAMILY;
        if (fam[natural] && fam[natural] === fam[playing])      return 0.72;     // 0.72 — same family
        return 0.50;                                                              // 0.50 — different family
    }

    // Combined per-player multiplier used by all rating computations.
    static perPlayerMult(player) {
        return ZoneStrength.fatigueMult(player)
             * ZoneStrength.moraleMult(player)
             * ZoneStrength.positionMult(player);
    }

    // ─── 3-band engine ratings ────────────────────────────────────────────────
    static bandRatings(teamObj, formation) {
        if (!teamObj || !teamObj.onField || teamObj.onField.length === 0) {
            return { attack: 50, midfield: 50, defense: 50 };
        }
        const bonus = ZoneStrength.formationBonus(formation);
        let atkSum = 0, atkN = 0, midSum = 0, midN = 0, defSum = 0, defN = 0;

        teamObj.onField.forEach(p => {
            const fm = ZoneStrength.perPlayerMult(p);   // fatigue × morale

            if (ZoneStrength.ATTACK_POS.includes(p.position)) {
                const r = ((p.finishing || 50) * 0.30 + (p.offTheBall || 50) * 0.25 +
                           (p.composure || 50) * 0.20 + (p.dribbling || 50) * 0.15 +
                           (p.heading || 50) * 0.10) * fm;
                atkSum += r; atkN++;
            } else if (ZoneStrength.MID_POS.includes(p.position)) {
                const r = ((p.passing || 50) * 0.25 + (p.vision || 50) * 0.20 +
                           (p.creativity || 50) * 0.20 + (p.tackling || 50) * 0.15 +
                           (p.stamina || 50) * 0.10 + (p.anticipation || 50) * 0.10) * fm;
                midSum += r; midN++;
            } else if (ZoneStrength.DEFENSE_POS.includes(p.position)) {
                const r = ((p.marking || 50) * 0.30 + (p.tackling || 50) * 0.25 +
                           (p.heading || 50) * 0.20 + (p.anticipation || 50) * 0.15 +
                           (p.strength || 50) * 0.10) * fm;
                defSum += r; defN++;
            } else if (p.position === 'GK') {
                const r = ((p.reflexes || 50) * 0.35 + (p.handling || 50) * 0.30 +
                           (p.positioning || 50) * 0.20 + (p.composure || 50) * 0.15) * fm;
                defSum += r; defN++;
            }
        });

        return {
            attack:   (atkN > 0 ? atkSum / atkN : 50) * bonus.attack,
            midfield: (midN > 0 ? midSum / midN : 50) * bonus.midfield,
            defense:  (defN > 0 ? defSum / defN : 50) * bonus.defense,
        };
    }

    // ─── 15-cell debug grid (5 bands × 3 lanes by default) ────────────────────
    //
    // Parameters:
    //   playerTeam, cpuTeam:  team objects with .onField
    //   homeLookup(idx, isPlayerTeam) → { x, y } | undefined
    //                         (typically a thin wrapper around matchFlow._home.get(...))
    //   overallOf(player)    → number (position-weighted overall, e.g. calculateOverall)
    //   bands, lanes         → grid dimensions
    //   radius               → pitch-percent influence radius
    //   scale                → tuning constant so cell totals land in a readable range
    static gridStrengths({
        playerTeam, cpuTeam,
        homeLookup, overallOf,
        bands = 5, lanes = 3,
        radius = 38, scale = 0.6,
    } = {}) {
        const bandSize = 100 / bands;
        const laneSize = 100 / lanes;
        const cells = Array.from({ length: bands * lanes }, () => ({ player: 0, cpu: 0 }));

        const place = (key, teamObj, isPlayer) => {
            if (!teamObj?.onField) return;
            teamObj.onField.forEach((p, idx) => {
                const home = homeLookup(idx, isPlayer);
                if (!home) return;
                const overall = overallOf(p);
                const fm = ZoneStrength.perPlayerMult(p);   // fatigue × morale
                const contribution = overall * fm * scale;

                for (let l = 0; l < lanes; l++) {
                    const cy = (l + 0.5) * laneSize;
                    for (let b = 0; b < bands; b++) {
                        const cx = (b + 0.5) * bandSize;
                        const d  = Math.hypot(home.x - cx, home.y - cy);
                        if (d >= radius) continue;
                        const w = 1 - d / radius;       // linear falloff to 0 at the boundary
                        cells[l * bands + b][key] += contribution * w;
                    }
                }
            });
        };
        place('player', playerTeam, true);
        place('cpu',    cpuTeam,    false);

        return cells.map(c => ({
            player: c.player > 0.5 ? Math.round(c.player) : null,
            cpu:    c.cpu    > 0.5 ? Math.round(c.cpu)    : null,
        }));
    }
}
