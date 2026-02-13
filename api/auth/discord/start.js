/**
 * Vercel serverless: GET /api/auth/discord/start
 * Starts Discord OAuth2 login (authorization code grant).
 */
const crypto = require('crypto');
const { serializeCookie } = require('../../lib/cookies');

function buildAuthorizeUrl(params) {
  const url = new URL('https://discord.com/oauth2/authorize');
  Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));
  return url.toString();
}

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI' }));
  }

  const state = crypto.randomBytes(16).toString('hex');
  const stateCookie = serializeCookie('gta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api/auth/discord',
    maxAge: 10 * 60, // 10 minutes
  });

  res.setHeader('Set-Cookie', stateCookie);

  const authUrl = buildAuthorizeUrl({
    response_type: 'code',
    client_id: clientId,
    scope: 'identify',
    redirect_uri: redirectUri,
    state: state,
    prompt: 'consent',
  });

  res.statusCode = 302;
  res.setHeader('Location', authUrl);
  return res.end();
};
