/**
 * AudioFx — pure-synthetic match sound effects via Web Audio API.
 * No samples, no external files. Every effect is generated from oscillators / filtered noise.
 *
 * Lifecycle: AudioContext can only start after a user gesture. The class lazy-inits on the
 * first sound call; the simulator triggers a benign init on the Start Match click.
 *
 * Voice limit: at most 6 concurrent sounds — when the simulator floods events on a tick
 * (e.g. a goal followed by celebration substitutions), excess sounds are skipped silently.
 */
class AudioFx {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.55;
        this._activeVoices = 0;
        this.maxVoices = 6;
    }

    _ensure() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : this.volume;
            this.master.connect(this.ctx.destination);
        } catch (e) {
            console.warn('Web Audio init failed:', e);
            return null;
        }
        return this.ctx;
    }

    setMuted(muted) {
        this.muted = !!muted;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.04);
        }
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.master && this.ctx && !this.muted) {
            this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
        }
    }

    _voiceBlocked() { return this.muted || this._activeVoices >= this.maxVoices; }
    _voiceAdd(durSec) {
        this._activeVoices++;
        setTimeout(() => { this._activeVoices = Math.max(0, this._activeVoices - 1); },
                   Math.max(20, durSec * 1000 + 60));
    }

    // ─── Primitives ─────────────────────────────────────────────────────────

    // Short pitched tone with ADSR-ish envelope
    _tone({ freq = 440, type = 'sine', dur = 0.15, attack = 0.005, decay = 0.08,
            gain = 0.2, glide = null }) {
        const ctx = this._ensure();
        if (!ctx || this._voiceBlocked()) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide.to), t + glide.time);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(gain, t + attack);
        env.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
        osc.connect(env).connect(this.master);
        osc.start(t);
        osc.stop(t + attack + decay + 0.05);
        this._voiceAdd(attack + decay);
    }

    // Filtered noise burst (white / pink-ish, lowpass / bandpass)
    _noise({ dur = 0.2, filter = 'lowpass', filterFreq = 2000, q = 0.7, gain = 0.2,
             attack = 0.01, pink = false }) {
        const ctx = this._ensure();
        if (!ctx || this._voiceBlocked()) return;
        const t = ctx.currentTime;
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        if (pink) {
            // Crude pink-ish noise via running average
            let p = 0;
            for (let i = 0; i < len; i++) {
                p = p * 0.95 + (Math.random() * 2 - 1) * 0.05;
                data[i] = p * 6;
            }
        } else {
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const flt = ctx.createBiquadFilter();
        flt.type = filter;
        flt.frequency.value = filterFreq;
        flt.Q.value = q;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(gain, t + attack);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(flt).connect(env).connect(this.master);
        src.start(t);
        src.stop(t + dur + 0.05);
        this._voiceAdd(dur);
    }

    // ─── Effect recipes ─────────────────────────────────────────────────────

    // Referee whistle — two square oscillators with FM vibrato. short=PE-blip / long=full-time
    whistle(short = false) {
        const ctx = this._ensure();
        if (!ctx || this._voiceBlocked()) return;
        const t = ctx.currentTime;
        const dur = short ? 0.22 : 0.55;
        [2700, 4000].forEach(f => {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = f;
            lfo.frequency.value = 16;
            lfoGain.gain.value = 22;
            lfo.connect(lfoGain).connect(osc.frequency);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.10, t + 0.02);
            env.gain.setValueAtTime(0.10, t + dur - 0.07);
            env.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.connect(env).connect(this.master);
            osc.start(t); lfo.start(t);
            osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
        });
        this._voiceAdd(dur);
    }

    // Quick low-pass noise thump — pass, shot setup, kick
    kick() {
        this._noise({ dur: 0.07, filter: 'lowpass', filterFreq: 900, gain: 0.18, attack: 0.001 });
    }

    // Mid-level crowd reaction — chance, save, one-on-one
    crowdCheer() {
        this._noise({ dur: 1.3, filter: 'bandpass', filterFreq: 500, q: 0.8, gain: 0.22, attack: 0.3, pink: true });
    }

    // Big goal celebration — crowd roar + brass-band sawtooth glide
    goalRoar() {
        const ctx = this._ensure();
        if (!ctx) return;
        this.crowdCheer();
        const t = ctx.currentTime;
        const dur = 2.0;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(330, t + 0.7);
        osc.frequency.setValueAtTime(330, t + 1.4);
        osc.frequency.exponentialRampToValueAtTime(140, t + dur);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.13, t + 0.18);
        env.gain.setValueAtTime(0.13, t + 1.4);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(env).connect(this.master);
        osc.start(t); osc.stop(t + dur + 0.05);
        this._voiceAdd(dur);
    }

    // Metallic ping on crossbar / post
    woodwork() {
        this._tone({ freq: 3200, type: 'sine', dur: 0.12, attack: 0.001, decay: 0.11, gain: 0.18 });
        this._tone({ freq: 1600, type: 'sine', dur: 0.18, attack: 0.001, decay: 0.17, gain: 0.10 });
    }

    // Keeper save — noise thump + low crowd "oof"
    save() {
        this._noise({ dur: 0.10, filter: 'lowpass', filterFreq: 700, gain: 0.16, attack: 0.001 });
        this._noise({ dur: 0.4, filter: 'lowpass', filterFreq: 360, gain: 0.14, attack: 0.1, pink: true });
    }

    // Sad crowd "ohhh" — missed shot, disallowed goal
    crowdGroan() {
        const ctx = this._ensure();
        if (!ctx) return;
        this._noise({ dur: 0.9, filter: 'lowpass', filterFreq: 380, gain: 0.16, attack: 0.2, pink: true });
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(95, t + 0.8);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.06, t + 0.15);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(env).connect(this.master);
        osc.start(t); osc.stop(t + 0.95);
        this._voiceAdd(0.9);
    }

    // Yellow card / foul — short square buzz
    yellowCard() {
        this._tone({ freq: 220, type: 'square', dur: 0.22, attack: 0.005, decay: 0.20, gain: 0.13 });
    }
    // Red card — longer, lower, more menacing
    redCard() {
        this._tone({ freq: 150, type: 'square', dur: 0.55, attack: 0.005, decay: 0.52, gain: 0.16,
                     glide: { to: 90, time: 0.45 } });
    }

    // Tackle foul / offside chirp
    foul() {
        this._tone({ freq: 1100, type: 'sine', dur: 0.09, attack: 0.005, decay: 0.07, gain: 0.13 });
    }

    // UI click — used sparingly for taps that confirm an action
    click() {
        this._tone({ freq: 1200, type: 'sine', dur: 0.04, attack: 0.001, decay: 0.035, gain: 0.08 });
    }

    // Penalty-kick build-up: low rising sawtooth drone + soft pink-noise crowd
    // hush + three heartbeat thumps. Plays over ~2.2 seconds while the dramatic
    // scene composes itself — gives the moment a thrilling tense feel.
    penaltyTension() {
        const ctx = this._ensure();
        if (!ctx) return;
        // Rising drone — low, gliding upward
        this._tone({
            freq: 60, type: 'sawtooth', dur: 2.2,
            attack: 0.5, decay: 1.7, gain: 0.05,
            glide: { to: 90, time: 1.8 },
        });
        // Soft pink-noise crowd hush underneath
        this._noise({
            dur: 2.0, filter: 'bandpass', filterFreq: 380, q: 1.4,
            gain: 0.07, attack: 0.4, pink: true,
        });
        // Heartbeat thumps — three slow beats
        [60, 700, 1400].forEach(offset => {
            setTimeout(() => {
                this._noise({
                    dur: 0.16, filter: 'lowpass', filterFreq: 160,
                    gain: 0.14, attack: 0.005,
                });
            }, offset);
        });
    }
}
