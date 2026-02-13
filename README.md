# GTA Bot Website

Static site for the GTA Discord Bot. Works on **GitHub Pages** and locally. Stats are powered by **Neon** (verified via Neon MCP: `get_website_global_stats()` and `get_leaderboard_top()`).

## Deploy to GitHub Pages

1. **Option A – Use the `Website` folder as the source**
   - In your repo, go to **Settings → Pages**.
   - Under "Build and deployment", set **Source** to "Deploy from a branch".
   - Choose the branch (e.g. `main`) and set the folder to **`/ (root)`**.
   - Put the *contents* of this `Website` folder (e.g. `index.html`, `css/`, `js/`, `privacy.html`, `terms.html`) in the **root** of that branch, or in a **`docs`** folder and select **`/docs`** as the source.

2. **Option B – Project site in a subfolder**
   - Keep the site in a subfolder (e.g. `Website/`) and set Pages to deploy from that branch with root or `docs` as above. Then the site URL will be `https://username.github.io/repo-name/` and the base path is handled automatically.

3. **Stats (Neon API)**
   - **Local:** From project root run `python -m src.services.stats_api`; the site auto-uses `http://127.0.0.1:8765`.
   - **GitHub Pages:** Deploy the repo’s **`api/`** folder to [Vercel](https://vercel.com): connect the repo, set **Root Directory** to the repo root (so Vercel finds `api/stats/global.js` and `api/stats/leaderboard.js`), add env **`DATABASE_URL`** with your Neon connection string (from [Neon Console](https://console.neon.tech) or MCP), then in `js/config.js` set `window.__NEON_STATS_API_URL__ = 'https://your-vercel-project.vercel.app';`.
   - The Stats page then shows live graphs and leaderboards from Neon. The Python stats API is optional for local use only.

Paths work on both user sites (`username.github.io`) and project sites (`username.github.io/repo-name/`) via the in-page base path script.
