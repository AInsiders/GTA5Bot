# Stats API (Vercel serverless)

Endpoints mirror the Python `src.services.stats_api` so the **GitHub Pages** site can load live stats from Neon.

## Endpoints

- `GET /api/stats/health` — check Neon connectivity
- `GET /api/stats/global` — global stats (users, cash, chips, level, etc.)
- `GET /api/stats/leaderboard?type=net_worth|cash|chips|level|rep|bank&limit=100` — top 100 leaderboard
- `GET /api/stats/user` — **dashboard**: logged-in user’s stats from Neon (requires `Authorization: Bearer <JWT>`). Uses same Neon connection as global.

## Neon: two ways to connect

The API supports **either** of these (REST is preferred if you already use the Data API):

### Option A — Neon Data API (REST)

In Vercel → **Settings → Environment Variables** add:

| Name | Value |
|------|--------|
| `NEON_REST_URL` | Your Data API base URL, e.g. `https://ep-ancient-rain-aij3erpd.apirest.c-4.us-east-1.aws.neon.tech/neondb/rest/v1` |
| `NEON_API_KEY` or `NEON_JWT` | API key or JWT from Neon Console → your project → **Data API** (or Auth). Do not commit this. |

Get the URL from Neon Console → your project → **Data API** → API URL. The key/JWT is shown or generated there when the Data API is enabled.

### Option B — Connection string (driver)

| Name | Value |
|------|--------|
| `DATABASE_URL` or `NEON_DATABASE_URL` | Your Neon PostgreSQL connection string (Neon Console → Connection string, or Neon MCP `get_connection_string`). Do not commit this. Used by both global and user stats. |

### Dashboard (user stats) and auth

| Name | Value |
|------|--------|
| `AUTH_JWT_SECRET` | Secret used to sign/verify Discord OAuth JWTs. Required for `/api/auth/me` and `/api/stats/user`. Must match the secret used in `/api/auth/discord/callback`. |

## Deploy to Vercel (one-time)

1. **Login** (once):  
   `npx vercel login`

2. **Deploy from repo root**:  
   `npm run deploy:api`  
   (or `npx vercel --prod`). Use the repo root so Vercel finds `api/stats/*.js`.

3. **Add Neon** in the Vercel project → **Settings → Environment Variables** using **Option A** or **Option B** above.

4. **Redeploy** once after saving the env vars (Vercel → Deployments → ⋮ → Redeploy).

5. **Wire the site**:  
   In `Website/js/config.js` set  
   `window.__NEON_STATS_API_URL__ = 'https://YOUR_VERCEL_PROJECT.vercel.app';`  
   using the URL Vercel shows after deploy.

## Dependencies

Root `package.json` includes `@neondatabase/serverless`. Run `npm install` from the repo root before deploying.
