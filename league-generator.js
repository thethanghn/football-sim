/**
 * LeagueGenerator — builds a 10-club league for the user's chosen nation.
 *
 * Input:  the nation entry from SEA_NATIONS (with cities) + the user's chosen
 *         city name (becomes "the user's club").
 * Output: an array of 10 clubs, each:
 *   { cityName, clubName, jerseyColor, crestSeed, isUserClub,
 *     played, wins, draws, losses, goalsFor, goalsAgainst, points }
 *
 * Naming: <City> + a random suffix from a small pool (FC / United / SC / etc.).
 * Colours: pulled from a fixed palette, no duplicates within the league.
 * Crest:   only the seed is stored; CrestGenerator can rebuild the SVG on demand.
 */
class LeagueGenerator {

    static SUFFIXES = [
        'FC', 'United', 'City', 'SC', 'AFC',
        'Athletic', 'Rovers', 'Wanderers', 'Town', 'Albion',
    ];

    // Tasteful palette — varied enough that 10 clubs always get distinct kits.
    static PALETTE = [
        '#CC0000', '#1133CC', '#FFCC00', '#0a7a3c', '#FF6600',
        '#A855F7', '#222266', '#16A34A', '#0EA5E9', '#DC2626',
        '#7C2D12', '#0F766E', '#EAB308', '#9333EA', '#0369A1',
    ];

    // Total clubs in the generated league (incl. the user's).
    static LEAGUE_SIZE = 10;

    // Picks `n` distinct items from `arr`. Used to choose unique suffix +
    // palette colours so no two clubs share a kit.
    static _sample(arr, n) {
        const pool = arr.slice();
        const picked = [];
        while (picked.length < n && pool.length) {
            picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        return picked;
    }

    static _emptyTableRow() {
        return {
            played: 0, wins: 0, draws: 0, losses: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0,
        };
    }

    // Big cities trend wealthier than small towns, but only as a soft signal —
    // a third-tier town can occasionally fluke into a wealthy patron. Cities are
    // listed in roughly population-descending order in onboarding-data.js, so
    // we use the city's position as a size proxy:
    //   index 0 (capital-ish)  → base ≈ 100M
    //   tail of the list       → base ≈ 30M
    // Then multiplied by Normal(1.0, 0.30) for variance, clamped to a sane range.
    // Returns budget in "millions" (no real currency — purely a relative scale
    // used to drive foreign quota + squad quality).
    static _rollBudget(sizeIndex, citiesTotal) {
        const span = Math.max(1, citiesTotal - 1);
        const t = Math.min(1, sizeIndex / span);                 // 0 (big) → 1 (small)
        const base = 100 - 70 * t;                                // 100M → 30M
        const noise = Random.gaussianFloat(1.0, 0.30, 0.45, 1.70);
        return Math.round(Math.max(12, Math.min(180, base * noise)));
    }

    static _buildClub(city, isUser, colour, suffix, sizeIndex, citiesTotal) {
        return {
            cityName:    city.name,
            clubName:    `${city.name} ${suffix}`,
            jerseyColor: colour,
            crestSeed:   Math.floor(Math.random() * 99999),
            isUserClub:  !!isUser,
            budget:      this._rollBudget(sizeIndex, citiesTotal),
            ...this._emptyTableRow(),
        };
    }

    /**
     * Build the league.
     * @param {object} nation     - one entry from SEA_NATIONS (must have .cities)
     * @param {string} userCity   - name of the city the user picked
     * @returns {Array} clubs[10] — user's club first, others in pick order
     */
    static generateLeague(nation, userCity) {
        if (!nation || !Array.isArray(nation.cities) || nation.cities.length === 0) {
            console.warn('LeagueGenerator: invalid nation');
            return [];
        }

        // Preserve each city's index in the nation's list — that's our "size"
        // proxy (capital/major hubs are listed first in onboarding-data.js).
        const indexed = nation.cities.map((c, i) => ({ city: c, sizeIndex: i }));
        const total   = nation.cities.length;
        const user    = indexed.find(e => e.city.name === userCity) || indexed[0];

        // Pick 9 other cities (or fewer if the nation lists fewer than 10).
        const others = indexed
            .filter(e => e.city.name !== user.city.name)
            .slice(0, this.LEAGUE_SIZE - 1);

        // Distinct suffix + colour per club so the table isn't a sea of duplicates.
        const colours  = this._sample(this.PALETTE,  others.length + 1);
        const suffixes = this._sample(this.SUFFIXES, others.length + 1);

        const clubs = [];
        clubs.push(this._buildClub(user.city, true, colours[0], suffixes[0], user.sizeIndex, total));
        others.forEach((e, i) => {
            clubs.push(this._buildClub(e.city, false, colours[i + 1], suffixes[i + 1], e.sizeIndex, total));
        });

        return clubs;
    }

    // Round-robin fixture schedule using the standard "circle method".
    // For an even number of clubs n: returns n-1 rounds, each with n/2 matches.
    // Home/away here is informational — the simulator picks who attacks first.
    // (Single round-robin for now; double-round can be added by mirroring.)
    static generateFixtures(clubs) {
        const teams = clubs.map(c => c.clubName);
        if (teams.length < 2) return [];

        // Pad with a "bye" (null) if odd so the circle method works
        const arr = teams.slice();
        if (arr.length % 2 !== 0) arr.push(null);

        const n = arr.length;
        const numRounds = n - 1;
        const rounds = [];

        for (let r = 0; r < numRounds; r++) {
            const matches = [];
            for (let i = 0; i < n / 2; i++) {
                const home = arr[i];
                const away = arr[n - 1 - i];
                if (home && away) {
                    matches.push({
                        home, away,
                        played: false, homeScore: null, awayScore: null,
                    });
                }
            }
            rounds.push({ round: r + 1, matches });
            // Rotate: first slot fixed, others shift clockwise by one
            const fixed = arr[0];
            const rest  = arr.slice(1);
            rest.unshift(rest.pop());
            arr.splice(0, arr.length, fixed, ...rest);
        }
        return rounds;
    }

    // Sorts a league table by standard football criteria:
    //   1) Points (desc)  2) Goal difference (desc)  3) Goals scored (desc)
    //   4) Alphabetical club name (tie-break)
    static sortTable(clubs) {
        return clubs.slice().sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = (a.goalsFor || 0) - (a.goalsAgainst || 0);
            const gdB = (b.goalsFor || 0) - (b.goalsAgainst || 0);
            if (gdB !== gdA) return gdB - gdA;
            if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
            return (a.clubName || '').localeCompare(b.clubName || '');
        });
    }
}

window.LeagueGenerator = LeagueGenerator;
