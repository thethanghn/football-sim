/**
 * ScreenLoader — fetches each screen partial from `screens/<name>.html` and
 * replaces the corresponding `<div data-screen="<name>"></div>` placeholder in
 * the main page. Runs at page load, before football-sim.js bootstraps the
 * simulator.
 *
 * Resolves a global `window.__screensReady` promise (and dispatches a
 * 'screensReady' event) when every screen is in the DOM. The simulator's
 * bootstrap waits on this so all `getElementById(...)` calls find the
 * injected nodes.
 *
 * Note: fetch() of relative URLs is blocked by some browsers under file://.
 * For local dev, serve the folder over HTTP (e.g. `python3 -m http.server`)
 * or open the page through the Netlify deploy.
 */
(function () {
    const SCREENS = [
        'formationScreen',
        'matchScreen',
        'managementScreen',
        'resultScreen',
        'clubhouseScreen',
    ];

    async function loadOne(name) {
        // `cache: 'no-store'` so the browser (and any CDN in front of it)
        // doesn't serve a stale partial when the screen markup changes.
        // The main page's <script src="...?v=NN"> already busts JS/CSS, but
        // these `fetch()` calls live outside that mechanism.
        const res = await fetch(`screens/${name}.html`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for screens/${name}.html`);
        const markup = (await res.text()).trim();
        const placeholder = document.querySelector(`[data-screen="${name}"]`);
        if (!placeholder) {
            console.warn(`ScreenLoader: no placeholder for "${name}" — appending to body.`);
            const tmp = document.createElement('div');
            tmp.innerHTML = markup;
            while (tmp.firstChild) document.body.appendChild(tmp.firstChild);
            return;
        }
        placeholder.outerHTML = markup;
    }

    function showLoadError(err) {
        console.error('ScreenLoader fatal:', err);
        document.body.innerHTML = `
            <div style="padding:24px;font-family:Arial,sans-serif;color:#eee;background:#1a1a1a;min-height:100vh">
                <h1 style="color:#FFD700;margin-top:0">Couldn't load game screens</h1>
                <p style="color:#FCA5A5;font-family:monospace">${(err && err.message) || err}</p>
                <p>Most likely cause: this page was opened via <code>file://</code>, where browsers block
                   <code>fetch()</code> of relative URLs.</p>
                <p>Fix: serve the folder over HTTP. From this directory run:</p>
                <pre style="background:#0a0a0a;padding:12px;border-radius:4px;color:#39FF14">python3 -m http.server 8000</pre>
                <p>…then open <a style="color:#FFD700" href="http://localhost:8000/football-sim.html">http://localhost:8000/football-sim.html</a>.</p>
            </div>`;
    }

    window.__screensReady = (async () => {
        try {
            await Promise.all(SCREENS.map(loadOne));
            window.dispatchEvent(new Event('screensReady'));
            console.log('ScreenLoader: all screens injected.');
        } catch (err) {
            showLoadError(err);
            throw err;
        }
    })();
})();
