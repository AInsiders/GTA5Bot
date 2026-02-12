# GTA Bot Website

Static site for the GTA Discord Bot. Works on **GitHub Pages** and locally.

## Deploy to GitHub Pages

1. **Option A – Use the `Website` folder as the source**
   - In your repo, go to **Settings → Pages**.
   - Under "Build and deployment", set **Source** to "Deploy from a branch".
   - Choose the branch (e.g. `main`) and set the folder to **`/ (root)`**.
   - Put the *contents* of this `Website` folder (e.g. `index.html`, `css/`, `js/`, `privacy.html`, `terms.html`) in the **root** of that branch, or in a **`docs`** folder and select **`/docs`** as the source.

2. **Option B – Project site in a subfolder**
   - Keep the site in a subfolder (e.g. `Website/`) and set Pages to deploy from that branch with root or `docs` as above. Then the site URL will be `https://username.github.io/repo-name/` and the base path is handled automatically.

3. **Stats on GitHub Pages**
   - The Stats page needs the stats API. On localhost it uses `http://127.0.0.1:8765` by default.
   - For production, deploy the stats API (e.g. `python -m src.services.stats_api`) to a host (Render, Railway, Fly.io, etc.), then in `js/config.js` set:
   - `window.__NEON_STATS_API_URL__ = 'https://your-stats-api-url';`
   - Redeploy the site so the Stats page uses that URL.

Paths work on both user sites (`username.github.io`) and project sites (`username.github.io/repo-name/`) via the in-page base path script.
