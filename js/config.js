/**
 * GitHub + Vercel: set your Vercel API base URL here (same origin for global stats and dashboard).
 * - Global Stats page: /api/stats/global, /api/stats/leaderboard
 * - Dashboard (user stats): /api/stats/user, /api/auth/me (requires login)
 * In Vercel project env set: DATABASE_URL (Neon), AUTH_JWT_SECRET (Discord auth), and optionally SITE_URL (your site origin, e.g. https://youruser.github.io/your-repo) for CORS.
 */
window.__GTA_API_URL__ = 'https://gta-5-bot.vercel.app';
window.__NEON_STATS_API_URL__ = window.__GTA_API_URL__;
