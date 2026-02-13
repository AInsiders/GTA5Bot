/**
 * Vercel serverless: GET /api/auth/discord/callback
 * Exchanges code for access token, fetches user, returns signed session token to the frontend.
 *
 * Redirects back to: `${SITE_URL}?session=<jwt>#dashboard`
 */
const { parseCookies, serializeCookie } = require('../../../lib/cookies');
const { signJwt } = require('../../../lib/jwt');

function getEnv(name) {
  return (process.env[name] || '').trim();
}

function safeSiteUrl() {
  const site = getEnv('SITE_URL');
  if (!site) return '';
  try {
    const u = new URL(site);
    return u.toString();
  } catch (e) {
    return '';
  }
}

async function exchangeCodeForToken(code, redirectUri, clientId, clientSecret) {
  const tokenUrl = 'https://discord.com/api/oauth2/token';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  });

  const basic = Buffer.from(clientId + ':' + clientSecret, 'utf8').toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + basic,
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Token exchange failed');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid token response');
  }
}

async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to fetch user');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid user response');
  }
}

function getQueryParam(req, name) {
  try {
    const host = (req.headers && (req.headers.host || req.headers.Host)) ? String(req.headers.host || req.headers.Host) : 'localhost';
    const raw = req.url || (req.path || '') + (req.rawQuery ? '?' + req.rawQuery : '');
    const u = new URL(raw.startsWith('http') ? raw : 'https://' + host + (raw.startsWith('/') ? raw : '/' + raw));
    return u.searchParams.get(name) || '';
  } catch (e) {
    if (req.query && typeof req.query[name] === 'string') return req.query[name];
    return '';
  }
}

module.exports = async function handler(req, res) {
  try {
    const method = (req.method || req.httpMethod || 'GET').toUpperCase();
    if (method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Method not allowed');
    }

    const code = getQueryParam(req, 'code');
    const state = getQueryParam(req, 'state');
    const error = getQueryParam(req, 'error');

    const siteUrl = safeSiteUrl();
    const clientId = getEnv('DISCORD_CLIENT_ID');
    const clientSecret = getEnv('DISCORD_CLIENT_SECRET');
    const redirectUri = getEnv('DISCORD_REDIRECT_URI');
    const jwtSecret = getEnv('AUTH_JWT_SECRET');

    if (!siteUrl) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Missing SITE_URL env var');
    }
    if (!clientId || !clientSecret || !redirectUri) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Missing Discord OAuth env vars');
    }
    if (!jwtSecret) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Missing AUTH_JWT_SECRET env var');
    }

    if (error) {
      res.statusCode = 302;
      res.setHeader('Location', siteUrl + '#login');
      return res.end();
    }

    if (!code || !state) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Missing code/state');
    }

    const cookies = parseCookies(req);
    const expectedState = cookies.gta_oauth_state || '';
    if (!expectedState || expectedState !== state) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('Invalid state');
    }

    try {
      const tokenData = await exchangeCodeForToken(code, redirectUri, clientId, clientSecret);
      const accessToken = tokenData && tokenData.access_token;
      if (!accessToken) throw new Error('Missing access_token');

      const user = await fetchDiscordUser(accessToken);
      const now = Math.floor(Date.now() / 1000);
      const sessionToken = signJwt({
        sub: user.id,
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        avatar: user.avatar,
        iat: now,
        exp: now + (7 * 24 * 60 * 60), // 7 days
      }, jwtSecret);

      const clearState = serializeCookie('gta_oauth_state', 'deleted', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/api/auth/discord',
        maxAge: 0,
      });
      res.setHeader('Set-Cookie', clearState);

      const redirect = new URL(siteUrl);
      redirect.searchParams.set('session', sessionToken);
      redirect.hash = 'dashboard';
      res.statusCode = 302;
      res.setHeader('Location', redirect.toString());
      return res.end();
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end(e && e.message ? e.message : 'OAuth failed');
    }
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(err && err.message ? err.message : 'Server error');
  }
};
