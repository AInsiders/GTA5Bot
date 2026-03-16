# Deploying the site to GitHub Pages (e.g. ainsiders.github.io/GTA5Bot)

The frontend runs on **GitHub Pages**; the API runs on **Vercel**. For the dashboard to show signed-in user stats, Vercel must be configured correctly.

## API URL

`Website/js/config.js` points to:

- `window.__GTA_API_URL__ = 'https://gta-5-bot.vercel.app'`

So the live site at **https://ainsiders.github.io/GTA5Bot/** calls that Vercel project for auth and stats.

## Neon URLs (GTA Bot project)

Use **one** of these in Vercel so global and user stats use the same DB:

| Env var | Example value (your project) |
|--------|------------------------------|
| **REST** | |
| `NEON_REST_URL` | `https://ep-ancient-rain-aij3erpd.apirest.c-4.us-east-1.aws.neon.tech/neondb/rest/v1` |
| `NEON_API_KEY` or `NEON_JWT` | Your Data API key from Neon Console → GTA Bot → Data API |
| **or driver** | |
| `DATABASE_URL` or `NEON_DATABASE_URL` | `postgresql://authenticator:YOUR_PASSWORD@ep-ancient-rain-aij3erpd-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |

Use the **full** REST URL including `/neondb/rest/v1`. The driver connection string uses the **pooler** host (`-pooler.`).

## Vercel env vars (required for dashboard stats)

In the Vercel project that serves **https://gta-5-bot.vercel.app** (or whatever URL you set in `config.js`), add:

| Variable | Example / notes |
|----------|------------------|
| `AUTH_JWT_SECRET` | Same secret everywhere (e.g. from `.env.local`). **Name must be exactly `AUTH_JWT_SECRET`.** |
| **Neon (pick one):** | |
| `NEON_REST_URL` + `NEON_API_KEY` (or `NEON_JWT`) | Same as used for **global stats**. If global stats work, user stats now use this too (no need for `DATABASE_URL`). |
| **or** `DATABASE_URL` / `NEON_DATABASE_URL` | Neon PostgreSQL connection string (same as the bot uses). |
| `SITE_URL` | **`https://ainsiders.github.io/GTA5Bot`** (no trailing slash). Where users land after Discord login. |
| `DISCORD_CLIENT_ID` | Your Discord OAuth2 application client ID. |
| `DISCORD_CLIENT_SECRET` | Your Discord OAuth2 application secret. |
| `DISCORD_REDIRECT_URI` | **`https://gta-5-bot.vercel.app/api/auth/discord/callback`** (must match the URL in Discord Developer Portal → OAuth2 → Redirects). |

After changing any env var, **redeploy** the Vercel project.

## Why the dashboard shows "—" or "Couldn't load your stats"

- **401 / Invalid token** — `AUTH_JWT_SECRET` in Vercel is wrong, missing, or the env var name is not exactly `AUTH_JWT_SECRET`.
- **500** — User stats now use the **same** Neon config as global stats. If global stats work via `NEON_REST_URL` + `NEON_API_KEY`, user stats use that too (no `DATABASE_URL` needed). If you use `DATABASE_URL`, ensure it’s set and points to the same Neon DB as the bot.
- **Signed in but no stats** — Fix auth (401) or Neon config (500) as above.

## Quick check

1. Open **https://ainsiders.github.io/GTA5Bot/#dashboard?debug=1**
2. Open browser DevTools (F12) → Console.
3. Sign in if needed, then look for `[GTA Dashboard] /api/stats/user response 401` or `500`. That confirms the stats request is failing; fix the matching env var above and redeploy.
