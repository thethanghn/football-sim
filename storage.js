/**
 * GameStorage — thin, versioned wrapper around localStorage for the football
 * simulator. Persists:
 *   - Settings  (mute, volume, match speed)
 *   - Player team (squad + crest seed + tactics + formation)
 *   - Match history (last 50 matches: score, opponent, scorers)
 *
 * Keys are namespaced `fsim:1:*` so a future schema bump (v2) can coexist with
 * old data instead of corrupting it. All reads/writes go through JSON; failures
 * (localStorage disabled, quota, parse error) degrade silently to in-memory.
 *
 * CPU team is intentionally NOT persisted — every match generates a fresh
 * opponent. The history log records who the player faced.
 */
class GameStorage {

    static KEY_PREFIX = 'fsim:1:';

    // Domain keys (joined with the prefix on read/write)
    static KEYS = {
        settings:    'settings',
        manager:     'manager',       // { name, nation, city, clubName, createdAt }
        league:      'league',        // the generated 10-club league + standings
        fixtures:    'fixtures',      // round-robin schedule for the season
        currentDate: 'currentDate',   // in-game calendar (YYYY-MM-DD)
        playerTeam:  'playerTeam',
        tactics:     'tactics',
        history:     'history',
    };

    // ─── Availability check (cached) ────────────────────────────────────
    static _avail = undefined;
    static get available() {
        if (this._avail !== undefined) return this._avail;
        try {
            const t = '__fsim_storage_test__';
            window.localStorage.setItem(t, t);
            window.localStorage.removeItem(t);
            this._avail = true;
        } catch (e) {
            console.warn('GameStorage: localStorage unavailable —', e?.message);
            this._avail = false;
        }
        return this._avail;
    }

    // ─── Low-level get / set ────────────────────────────────────────────
    static _read(key) {
        if (!this.available) return null;
        try {
            const raw = window.localStorage.getItem(this.KEY_PREFIX + key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn(`GameStorage._read(${key}) failed:`, e?.message);
            return null;
        }
    }

    static _write(key, data) {
        if (!this.available) return false;
        try {
            window.localStorage.setItem(this.KEY_PREFIX + key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn(`GameStorage._write(${key}) failed:`, e?.message);
            return false;
        }
    }

    static _remove(key) {
        if (!this.available) return;
        try { window.localStorage.removeItem(this.KEY_PREFIX + key); } catch (e) {}
    }

    // ─── Settings (mute / volume / matchSpeed) ──────────────────────────
    static loadSettings() {
        return this._read(this.KEYS.settings) || { muted: false, volume: 0.55, speed: 'fast' };
    }
    static saveSettings(s) {
        // Coerce shape so partial updates don't corrupt other fields
        const cur = this.loadSettings();
        const next = { ...cur, ...s };
        return this._write(this.KEYS.settings, next);
    }

    // ─── Manager profile ────────────────────────────────────────────────
    // The "user" identity for the career. All saved data (team / tactics /
    // history) is conceptually owned by this manager — wiping the manager
    // via resetCareer() therefore wipes everything career-related.
    static loadManager() {
        return this._read(this.KEYS.manager);   // { name, createdAt } | null
    }
    static saveManager(profile) {
        return this._write(this.KEYS.manager, profile);
    }

    // ─── League (10-club table generated at onboarding) ─────────────────
    // Load runs Team._migratePlayer over every CPU roster so older saves get
    // the new fitness fields (condition / naturalFitness) back-filled the
    // first time they're read.
    static loadLeague() {
        const league = this._read(this.KEYS.league);
        // Migrate legacy player rosters + back-fill missing away-kit colours.
        // Team is a global class (loaded after storage.js); guard so this
        // helper still works if loaded standalone.
        const T = (typeof Team !== 'undefined') ? Team
                : (typeof window !== 'undefined' && window.Team) ? window.Team : null;
        if (Array.isArray(league) && T) {
            league.forEach(c => {
                if (T._migratePlayer && Array.isArray(c.players)) {
                    c.players = c.players.map(T._migratePlayer);
                }
                if (T.computeAwayColor) {
                    if (!c.homeColor) c.homeColor = c.jerseyColor;
                    if (!c.awayColor) c.awayColor = T.computeAwayColor(c.jerseyColor);
                }
            });
        }
        return league;
    }
    static saveLeague(clubs) { return this._write(this.KEYS.league, clubs); }

    // ─── Fixtures (round-robin schedule for the league) ─────────────────
    // Load auto-heals old single-leg saves by appending the mirror second leg
    // (older versions of LeagueGenerator only produced n-1 rounds). Writes the
    // upgraded list back so subsequent loads short-circuit.
    static loadFixtures() {
        const rounds = this._read(this.KEYS.fixtures);
        if (!rounds || !rounds.length || typeof window === 'undefined' || !window.LeagueGenerator) {
            return rounds;
        }
        const league = this.loadLeague();
        const fixed  = window.LeagueGenerator.backfillSecondLegIfMissing(rounds, league);
        if (fixed !== rounds) {
            this._write(this.KEYS.fixtures, fixed);
            console.log(`Fixtures upgraded: ${rounds.length} → ${fixed.length} rounds (second leg backfilled)`);
        }
        return fixed;
    }
    static saveFixtures(rounds) { return this._write(this.KEYS.fixtures, rounds); }

    // ─── In-game calendar ──────────────────────────────────────────────
    // YYYY-MM-DD. The match flow advances this whenever a fixture is played.
    static loadCurrentDate() { return this._read(this.KEYS.currentDate); }
    static saveCurrentDate(iso) { return this._write(this.KEYS.currentDate, iso); }

    // ─── Player team snapshot ───────────────────────────────────────────
    // Expects a plain object produced by Team#serialize():
    //   { teamName, jerseyColor, clubName, crestSeed, players, formation }
    static loadPlayerTeam() {
        return this._read(this.KEYS.playerTeam);
    }
    static savePlayerTeam(snapshot) {
        return this._write(this.KEYS.playerTeam, snapshot);
    }

    // ─── Tactics + formation (the player's current setup) ───────────────
    static loadTactics() {
        return this._read(this.KEYS.tactics);   // { tactics: {...}, formation: '442' } | null
    }
    static saveTactics(tactics, formation) {
        return this._write(this.KEYS.tactics, { tactics, formation });
    }

    // ─── Match history (rolling last 50) ────────────────────────────────
    static loadHistory() {
        return this._read(this.KEYS.history) || [];
    }
    static appendHistory(entry) {
        const list = this.loadHistory();
        const stamped = { ...entry, date: entry.date || new Date().toISOString() };
        list.push(stamped);
        // Cap to last 50 so storage doesn't grow unbounded after long sessions
        const capped = list.slice(-50);
        return this._write(this.KEYS.history, capped);
    }
    static clearHistory() {
        this._remove(this.KEYS.history);
    }

    // ─── Reset career (wipes everything EXCEPT settings) ────────────────
    // Drops the manager profile too so the next boot lands on the
    // onboarding screen (step 1 — choose a manager name).
    static resetCareer() {
        this._remove(this.KEYS.manager);
        this._remove(this.KEYS.league);
        this._remove(this.KEYS.fixtures);
        this._remove(this.KEYS.currentDate);
        this._remove(this.KEYS.playerTeam);
        this._remove(this.KEYS.tactics);
        this._remove(this.KEYS.history);
    }

    // Nuke ALL persisted data — including settings. Useful from the console.
    static wipeAll() {
        if (!this.available) return;
        try {
            Object.keys(window.localStorage)
                .filter(k => k.startsWith(this.KEY_PREFIX))
                .forEach(k => window.localStorage.removeItem(k));
        } catch (e) {}
    }
}
