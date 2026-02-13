/**
 * Vercel serverless: GET /api/auth/me
 * Verifies a session JWT and returns Discord user identity for the dashboard.
 */
const { verifyJwt } = require('../../lib/jwt');

function allowedOrigin() {
  const site = (process.env.SITE_URL || '').trim();
  if (!site) return '*';
  try {
    return new URL(site).origin;
  } catch (e) {
    return '*';
  }
}

function cors(req, res) {
  const origin = allowedOrigin();
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
}

function getBearerToken(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    cors(req, res);
    res.statusCode = 204;
    return res.end();
  }
  if (method !== 'GET') {
    cors(req, res);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const secret = (process.env.AUTH_JWT_SECRET || '').trim();
  if (!secret) {
    cors(req, res);
    return sendJson(res, 500, { error: 'Missing AUTH_JWT_SECRET env var' });
  }

  const token = getBearerToken(req);
  if (!token) {
    cors(req, res);
    return sendJson(res, 401, { error: 'Missing bearer token' });
  }

  try {
    const payload = verifyJwt(token, secret);
    cors(req, res);
    return sendJson(res, 200, {
      id: payload.id || payload.sub,
      username: payload.username || '',
      global_name: payload.global_name || '',
      avatar: payload.avatar || '',
      exp: payload.exp,
    });
  } catch (e) {
    cors(req, res);
    return sendJson(res, 401, { error: (e && e.message) ? e.message : 'Invalid token' });
  }
};
