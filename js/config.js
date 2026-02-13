/**
 * Optional config for GitHub Pages / production.
 * When the site is on GitHub Pages, set your Vercel API base URL here.
 * This powers:
 * - Stats endpoints: /api/stats/*
 * - Discord auth endpoints: /api/auth/*
 * Options: (1) Deploy the repo's api/ folder to Vercel and add Neon DATABASE_URL in Vercel env, then set the URL below to your Vercel project URL. (2) Or use any other host that serves the same /api/stats/global and /api/stats/leaderboard endpoints.
 * Leave commented for localhost (auto-uses http://127.0.0.1:8765).
 */
// PASTE YOUR VERCEL URL BELOW (e.g. https://gta-5-bot.vercel.app) then uncomment the line:
window.__GTA_API_URL__ = 'https://gta-5-bot.vercel.app';
// Back-compat for existing stats scripts:
window.__NEON_STATS_API_URL__ = window.__GTA_API_URL__;
