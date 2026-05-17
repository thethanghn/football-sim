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
        // Compute the away-kit colour at creation time so it persists with the
        // league snapshot. Falls back to the home colour if Team isn't loaded
        // (e.g. unit test) — _buildCpuOpponent will lazy-fix on first use.
        const TeamCls = (typeof Team !== 'undefined') ? Team
                      : (typeof window !== 'undefined' && window.Team) ? window.Team : null;
        const awayColor = TeamCls?.computeAwayColor ? TeamCls.computeAwayColor(colour) : colour;
        return {
            cityName:    city.name,
            clubName:    `${city.name} ${suffix}`,
            jerseyColor: colour,
            homeColor:   colour,
            awayColor,
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
    // For an even number of clubs n: returns 2(n-1) rounds (double round-robin,
    // home + away leg) so a 10-club league spans 18 matchweeks like real life.
    // Home/away on the second leg is mirrored from the first.
    static generateFixtures(clubs) {
        const teams = clubs.map(c => c.clubName);
        if (teams.length < 2) return [];

        // Pad with a "bye" (null) if odd so the circle method works
        const arr = teams.slice();
        if (arr.length % 2 !== 0) arr.push(null);

        const n = arr.length;
        const numRounds = n - 1;
        const firstLeg = [];

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
            firstLeg.push({ round: r + 1, matches });
            // Rotate: first slot fixed, others shift clockwise by one
            const fixed = arr[0];
            const rest  = arr.slice(1);
            rest.unshift(rest.pop());
            arr.splice(0, arr.length, fixed, ...rest);
        }

        // Second leg — mirror home/away of each match.
        const secondLeg = firstLeg.map((r, idx) => ({
            round: numRounds + idx + 1,
            matches: r.matches.map(m => ({
                home: m.away, away: m.home,
                played: false, homeScore: null, awayScore: null,
            })),
        }));

        return [...firstLeg, ...secondLeg];
    }

    // Detect old single-leg saves (n-1 rounds instead of 2(n-1)) and append a
    // mirror second leg. Preserves any played results in the first leg, and
    // continues calendar dates from where the first leg left off (weekly
    // cadence, same alternating Sat/Sun pattern as scheduleFixtures).
    // Returns the input unchanged when both legs are already present.
    static backfillSecondLegIfMissing(rounds, league) {
        if (!Array.isArray(rounds) || !rounds.length) return rounds;
        const clubCount = Array.isArray(league) ? league.length : 0;
        if (clubCount < 2) return rounds;

        const n = clubCount + (clubCount % 2 === 0 ? 0 : 1);
        const expected = 2 * (n - 1);
        if (rounds.length >= expected) return rounds;

        // Only auto-upgrade exact-first-leg shape (n-1 rounds). Anything else
        // is unrecognised — leave it alone rather than guess.
        if (rounds.length !== n - 1) return rounds;

        const numRounds = rounds.length;
        const secondLeg = rounds.map((r, idx) => ({
            round: numRounds + idx + 1,
            matches: (r.matches || []).map(m => ({
                home: m.away, away: m.home,
                played: false, homeScore: null, awayScore: null,
            })),
        }));

        // Continue the calendar from the last first-leg date if present.
        const lastDate = rounds[rounds.length - 1]?.date;
        if (lastDate) {
            const start = new Date(lastDate);
            if (!isNaN(start.getTime())) {
                secondLeg.forEach((rd, i) => {
                    const d = new Date(start);
                    // i+1 so the first second-leg round lands one week after
                    // the last first-leg round; alternate Sat/Sun parity is
                    // preserved by including the +(i%2===1?1:0) offset
                    // against the global round index.
                    const globalIdx = numRounds + i;
                    d.setDate(d.getDate() + (i + 1) * 7);
                    // Re-anchor to Sat/Sun by absolute round parity
                    const wantSunday = globalIdx % 2 === 1;
                    const day = d.getDay();          // 0=Sun..6=Sat
                    const target = wantSunday ? 0 : 6;
                    const delta = (target - day + 7) % 7;
                    d.setDate(d.getDate() + delta);
                    rd.date = d.toISOString().slice(0, 10);
                });
            }
        }

        return [...rounds, ...secondLeg];
    }

    // Decorate each round with a calendar date, starting at `kickoffDate`
    // and spacing one round every 7 days. Per-round day-of-week alternates
    // between Saturday and Sunday (kickoff anchors round 1).
    // Mutates and returns the input rounds for convenience.
    static scheduleFixtures(rounds, kickoffDate) {
        if (!Array.isArray(rounds) || !rounds.length) return rounds;
        const start = new Date(kickoffDate);
        if (isNaN(start.getTime())) return rounds;
        rounds.forEach((round, i) => {
            const d = new Date(start);
            // Weekly cadence + alternate Sat/Sun by adding +1 day on odd rounds.
            d.setDate(d.getDate() + i * 7 + (i % 2 === 1 ? 1 : 0));
            round.date = d.toISOString().slice(0, 10);   // YYYY-MM-DD
        });
        return rounds;
    }

    // Find the next occurrence of the nation's league kickoff (month/day) on
    // or after `fromDate`. Nudges to the nearest following Saturday so the
    // opening weekend feels canonical regardless of which day-of-week the raw
    // date falls on.
    static nextKickoffDate(nation, fromDate) {
        const cal = nation?.leagueStart;
        if (!cal) return null;
        const from = new Date(fromDate);
        if (isNaN(from.getTime())) return null;
        let d = new Date(from.getFullYear(), cal.month - 1, cal.day);
        if (d < from) d = new Date(from.getFullYear() + 1, cal.month - 1, cal.day);
        // Snap forward to the nearest Saturday (getDay: 0=Sun..6=Sat)
        const delta = (6 - d.getDay() + 7) % 7;
        d.setDate(d.getDate() + delta);
        return d.toISOString().slice(0, 10);
    }

    // ─── Quick CPU-vs-CPU simulation ────────────────────────────────────
    // Cheap, no-animation match: turns two clubs' budgets into expected goal
    // counts and samples Poisson distributions to produce a final score.
    // Used to fill in the other 4 matches of the user's round when they Back
    // to Clubhouse — so the table moves even though we only animate one game.
    static _poisson(lambda) {
        const L = Math.exp(-Math.max(0.05, lambda));
        let k = 0, p = 1;
        do { k++; p *= Math.random(); } while (p > L);
        return k - 1;
    }

    static simulateScore(homeBudget = 60, awayBudget = 60) {
        const base       = 1.30;
        const homeBoost  = 0.30;
        // budget range ~12..180; centred at 60. Scale ±2.5 goals at the extremes.
        const diff       = (homeBudget - awayBudget) / 60;
        const homeExp    = Math.max(0.20, base + homeBoost + diff);
        const awayExp    = Math.max(0.20, base - diff);
        return {
            home: this._poisson(homeExp),
            away: this._poisson(awayExp),
        };
    }

    // Apply a match result to the league standings. Mutates the `league`
    // array in place. Returns the updated league for convenience.
    static applyResult(league, homeName, awayName, homeScore, awayScore) {
        if (!Array.isArray(league)) return league;
        const home = league.find(c => c.clubName === homeName);
        const away = league.find(c => c.clubName === awayName);
        if (!home || !away) return league;
        home.played++;        away.played++;
        home.goalsFor    += homeScore;   home.goalsAgainst += awayScore;
        away.goalsFor    += awayScore;   away.goalsAgainst += homeScore;
        if      (homeScore > awayScore) { home.wins++;   away.losses++; home.points += 3; }
        else if (homeScore < awayScore) { away.wins++;   home.losses++; away.points += 3; }
        else                            { home.draws++;  away.draws++;  home.points++; away.points++; }
        return league;
    }

    // Ensure a club has a persistent player roster — once generated, the same
    // objects accumulate career goals/assists across every simulated match for
    // the rest of the season. Uses Team.createPlayer (available at runtime)
    // so the roster has the same shape as a real Team's players. Nation is
    // passed in so the names match the league's home country.
    //
    // No-ops when the club already has a roster or when Team isn't loaded.
    static ensureRoster(club, nation, count = 18) {
        if (!club || (Array.isArray(club.players) && club.players.length >= 11)) return;
        const TeamCls = (typeof Team !== 'undefined') ? Team
                      : (typeof window !== 'undefined' && window.Team) ? window.Team : null;
        if (!TeamCls?.createPlayer) return;

        // Spread the budget shift across the roster so richer clubs really
        // do field stronger players. Range mirrors what Team uses internally.
        const qualityShift = Math.round(((club.budget || 60) - 60) * 0.25);
        // Reuse the same position blueprint as the user team so every CPU
        // club can field every formation — see Team.POSITION_BLUEPRINT.
        const BP    = TeamCls.POSITION_BLUEPRINT || [];
        const DEPTH = TeamCls.POSITION_DEPTH     || ['CB','CM','ST'];
        const positions = Array.from({ length: count }, (_, i) =>
            BP[i] || DEPTH[Math.floor(Math.random() * DEPTH.length)]);

        club.players = positions.map((pos, idx) => {
            const p = TeamCls.createPlayer(idx, club.jerseyColor, { nation, qualityShift, position: pos });
            // Career counters used by the league-wide top-scorer aggregator.
            p.goals   = p.goals   || 0;
            p.assists = p.assists || 0;
            return p;
        });
    }

    // Pick a "scorer" from a club's players, weighted by their finishing/off-
    // the-ball ability and biased toward forward positions. Returns null if
    // the club has no roster.
    static _pickScorer(club, excludeId) {
        const pool = (club?.players || []).filter(p => p.id !== excludeId && p.position !== 'GK');
        if (!pool.length) return null;
        const positionBias = { ST: 6, CF: 6, LW: 4, RW: 4, CAM: 4, LM: 2, RM: 2, CM: 2, CDM: 1, CB: 1, LB: 1, RB: 1, LWB: 1, RWB: 1 };
        const weights = pool.map(p => {
            const skill = ((p.finishing || p.shooting || 60) + (p.offTheBall || p.offensive || 60)) / 2;
            return Math.max(1, skill / 10) * (positionBias[p.position] || 1);
        });
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
        return pool[pool.length - 1];
    }

    // Pick an "assister" — playmakers (creativity/passing/vision), biased away
    // from defenders. excludeId stops the scorer assisting themselves.
    static _pickAssister(club, excludeId) {
        const pool = (club?.players || []).filter(p => p.id !== excludeId && p.position !== 'GK');
        if (!pool.length) return null;
        const positionBias = { CAM: 6, CM: 4, LW: 4, RW: 4, LM: 3, RM: 3, CDM: 2, ST: 2, CF: 2, LB: 1, RB: 1, LWB: 1, RWB: 1, CB: 1 };
        const weights = pool.map(p => {
            const skill = ((p.creativity || 60) + (p.passing || 60) + (p.vision || 60)) / 3;
            return Math.max(1, skill / 10) * (positionBias[p.position] || 1);
        });
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
        return pool[pool.length - 1];
    }

    // Run a CPU-vs-CPU match: same score generation as simulateScore, plus
    // per-goal scorer + (60%-chance) assister attribution that mutates each
    // club's player.goals / player.assists. Returns the score so callers can
    // feed it to applyResult.
    //
    // ensureRoster MUST have been called for both clubs first (caller's job).
    static simulateMatch(home, away) {
        const { home: homeGoals, away: awayGoals } = this.simulateScore(home?.budget || 60, away?.budget || 60);
        const attribute = (club, goals) => {
            for (let i = 0; i < goals; i++) {
                const scorer = this._pickScorer(club);
                if (!scorer) continue;
                scorer.goals = (scorer.goals || 0) + 1;
                if (Math.random() < 0.62) {
                    const assister = this._pickAssister(club, scorer.id);
                    if (assister) assister.assists = (assister.assists || 0) + 1;
                }
            }
        };
        attribute(home, homeGoals);
        attribute(away, awayGoals);
        return { home: homeGoals, away: awayGoals };
    }

    // Simulate every UNPLAYED match in a round and apply each result to the
    // league standings. `skipPredicate(match)` is given each match — return
    // true to leave it alone (used to skip the user's already-played match).
    // Mutates both `round.matches` and `league` (including each club's
    // `players[]` career stats via simulateMatch). Returns the round.
    static simulateRound(round, league, skipPredicate = () => false, opts = {}) {
        if (!round?.matches) return round;
        const findClub = (name) => (league || []).find(c => c.clubName === name);
        // Lazy roster pass: a saved league from before this change won't have
        // `players[]` populated. Caller can pre-run ensureRoster on every club
        // (preferred); we do a best-effort here for robustness.
        if (opts.nation && Array.isArray(league)) {
            league.forEach(c => this.ensureRoster(c, opts.nation));
        }
        round.matches.forEach(m => {
            if (m.played) return;
            if (skipPredicate(m)) return;
            const home = findClub(m.home);
            const away = findClub(m.away);
            // simulateMatch picks scorers/assisters from each club's persistent
            // roster and updates their career stats — so the league-wide top
            // scorer / top assist tables get full coverage, not just user games.
            const score = this.simulateMatch(home, away);
            m.homeScore = score.home;
            m.awayScore = score.away;
            m.played    = true;
            this.applyResult(league, m.home, m.away, score.home, score.away);
        });
        return round;
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
