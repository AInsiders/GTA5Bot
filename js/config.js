/**
 * GitHub + Vercel: one API base for both Global Stats and Dashboard (same Neon/Vercel connection).
 * - Global Stats: GET /api/stats/global, /api/stats/leaderboard (no auth)
 * - Dashboard: GET /api/stats/user (Bearer JWT), /api/auth/me (Bearer JWT)
 * Vercel env: DATABASE_URL or NEON_DATABASE_URL (Neon); AUTH_JWT_SECRET (Discord JWT). See Website/api/README.md.
 */
window.__GTA_API_URL__ = 'https://gta-5-bot.vercel.app';
window.__NEON_STATS_API_URL__ = window.__GTA_API_URL__;
