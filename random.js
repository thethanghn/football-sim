/**
 * Seeded random utilities.
 *
 * The LCG (a=9301, c=49297, m=233280) is the same one the original AvatarGenerator and
 * CrestGenerator used in-line, so existing seeds reproduce the same sequences and previously
 * rendered avatars / crests don't shift.
 *
 * Usage:
 *
 *   const rng = Random.seeded(42);
 *   rng();           // 0.7842…  (deterministic for this seed)
 *   rng();           // 0.4118…
 *
 *   Random.pick(['a','b','c'], rng);      // seeded pick
 *   Random.pick(['a','b','c']);           // Math.random()-backed pick
 *   Random.range(50, 90, rng);            // integer in [50, 90]
 *   Random.chance(0.25);                  // boolean — true 25 % of the time
 *
 * Pure module — no DOM, no side effects.
 */
class Random {
    /**
     * Returns a stateful seeded RNG. Each call advances the LCG and yields a float in [0, 1).
     * Different seeds give different sequences; the same seed gives the same sequence.
     */
    static seeded(seed) {
        // Accept any number (including 0) so seeds match the original inline LCG exactly;
        // non-finite inputs (undefined/null/NaN) fall back to 0 to avoid producing NaN.
        let s = Number.isFinite(seed) ? Math.floor(seed) : 0;
        return () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }

    /** Random element from an array. `rng` defaults to Math.random; pass a seeded RNG for determinism. */
    static pick(arr, rng = Math.random) {
        if (!arr || arr.length === 0) return undefined;
        return arr[Math.floor(rng() * arr.length)];
    }

    /** Integer in [lo, hi] (inclusive). */
    static range(lo, hi, rng = Math.random) {
        return lo + Math.floor(rng() * (hi - lo + 1));
    }

    /** Boolean — true with probability `p` (0..1). */
    static chance(p, rng = Math.random) {
        return rng() < p;
    }

    /** Weighted pick. `items` is an array; `weightOf(item)` returns a non-negative weight. */
    static pickWeighted(items, weightOf, rng = Math.random) {
        if (!items || items.length === 0) return undefined;
        const weights = items.map(weightOf);
        const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
        if (total <= 0) return items[Math.floor(rng() * items.length)];
        let r = rng() * total;
        for (let i = 0; i < items.length; i++) {
            r -= Math.max(0, weights[i]);
            if (r <= 0) return items[i];
        }
        return items[items.length - 1];
    }

    /** Shuffle a copy of an array (Fisher–Yates). */
    static shuffle(arr, rng = Math.random) {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    /** Sample from a Normal(mean, std) distribution via the Box–Muller transform. */
    static gaussian(mean = 0, std = 1, rng = Math.random) {
        // Avoid u1 = 0 (log(0) is -Infinity).
        let u1 = rng();
        while (u1 <= 0) u1 = rng();
        const u2 = rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * std;
    }

    /** Sample a Normal(mean, std) clamped to [lo, hi] and rounded to an integer. */
    static gaussianInt(mean, std, lo, hi, rng = Math.random) {
        const v = Math.round(Random.gaussian(mean, std, rng));
        return Math.max(lo, Math.min(hi, v));
    }
}
