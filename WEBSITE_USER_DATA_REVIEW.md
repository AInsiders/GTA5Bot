# Website User Data & Dashboard — Review

## Why global data works but user data “doesn’t show” after sign-in

### Connection check (Neon MCP)

- **Neon project:** GTA Bot (`icy-union-66121574`).
- **`public.users`** exists with `user_id` (text, Discord snowflakes). Sample rows confirmed.
- **`get_user_activity_stats(p_user_id TEXT)`** exists and is used by `/api/stats/user`.
- **Global stats** use the same DB (e.g. `get_website_global_stats()` or REST). So if global works, the Website API is talking to the same Neon DB.

### Data flow

1. **Sign-in:** User hits “Connect with Discord” → Discord OAuth → Vercel `/api/auth/discord/callback` → JWT signed with `id` / `sub` = Discord user id → redirect to `SITE_URL?session=<jwt>#dashboard`.
2. **Frontend:** `auth.js` reads `session` from the URL, stores the JWT in `localStorage`, then the dashboard calls:
   - `GET /api/auth/me` (Bearer JWT) → identity (id, username, avatar).
   - `GET /api/stats/user` (Bearer JWT) → game stats from `users` + `get_user_activity_stats(user_id)`.
3. **Backend user stats:** JWT is verified, `userId = payload.id || payload.sub` (Discord id). Then `SELECT * FROM users WHERE user_id = $userId`. Same id the bot uses in `storage.get_user(user_id)`.

So the **connection is correct**: same DB, same `user_id` meaning (Discord id).

### Why it can look like “user data doesn’t show”

1. **No row in `users` (most likely)**  
   Rows are created when someone uses the **bot in Discord** (e.g. `/start`), not when they only sign in on the website. If a user has never used the bot in Discord, there is no row → API returns 200 with empty/zero stats.  
   **Fix:** The API now returns `no_game_data_yet: true` in that case, and the dashboard shows a clear hint: “Use the bot in Discord (run `/start` …) to create your character; your stats will then appear here.”

2. **`/api/stats/user` returns 401**  
   Then the dashboard shows “Session expired” and only identity (from `/api/auth/me`), no stats. Possible causes:
   - Token not sent: `SITE_URL` in Vercel must be the URL where the user actually lands after OAuth (same origin as the site). If redirect goes to another domain, the `session` param isn’t on the page that loads and the token is never stored.
   - Token expired or invalid: JWT has a 7-day exp; if the user returns later, they need to log in again.
   - **Previously:** Any exception in the handler (e.g. DB timeout) was caught and returned as 401, so DB errors looked like “Session expired.”  
   **Fix:** The handler now returns **401** only for auth-related errors (missing/invalid/expired token). Other errors return **500** with a generic “Could not load user stats” message so the UI doesn’t say “Session expired” for server/DB issues.

3. **Wrong or missing env on Vercel**  
   - `AUTH_JWT_SECRET` must be set (same value used in callback and in `/api/auth/me`, `/api/stats/user`).
   - `DATABASE_URL` or `NEON_DATABASE_URL` must point to the same Neon project the bot uses (so `users` and RPCs are the same).

### Checklist

- [ ] **Vercel env:** `AUTH_JWT_SECRET`, `DATABASE_URL` (or `NEON_DATABASE_URL`), `SITE_URL` (exact URL where the site is loaded, so OAuth redirect lands there with `?session=...`).
- [ ] **Same Neon project** for bot and Vercel (e.g. GTA Bot `icy-union-66121574`).
- [ ] **User has used the bot in Discord** at least once (e.g. `/start`) so a `users` row exists; otherwise they see the “no game data yet” hint until they do.

### "I have game data but the dashboard shows —"

If you're signed in and see your name/avatar but all stat fields are "—", the **stats request is failing** (401 or 500). The dashboard shows the API's error in the yellow box.

- **401 / "Invalid token signature" or "Missing bearer token"** — Env name in Vercel must be exactly `AUTH_JWT_SECRET`. Value must match the secret used when you signed in. Redeploy after changing env.
- **401 / "Token expired"** — Log out and sign in again.
- **500 / "Missing AUTH_JWT_SECRET" or "Set DATABASE_URL"** — Add both in Vercel, using the **same** Neon connection string the bot uses. Redeploy.

### Code changes made

- **`Website/api/stats/user.js`:**  
  - Catch block: return 401 only for auth errors, 500 for DB/other errors.  
  - When no row in `users`, include `no_game_data_yet: true` in the JSON response.
- **`Website/js/dashboard.js`:**  
  - `showNoGameDataHint(show)` and call it when `stats.no_game_data_yet` is true; hide on guest view and when stats fail.
- **`Website/index.html`:**  
  - Added `<p id="dashboard-no-game-data-hint">` with the “use the bot in Discord” message.
- **`Website/css/styles.css`:**  
  - Styles for `.dashboard-no-game-data-hint`.
