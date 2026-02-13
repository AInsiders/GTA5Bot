/**
 * Vercel serverless: GET /api/auth/me
 * Verifies a session JWT and returns Discord user identity.
 */
const crypto = require('crypto');

function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecodeToString(input) {
  const str = String(input || '');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyJwt(token, secret) {
  if (!token) throw new Error('Missing token');
  if (!secret) throw new Error('Missing JWT secret');
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const signingInput = parts[0] + '.' + parts[1];
  const expectedSig = base64urlEncode(
    crypto.createHmac('sha256', String(secret)).update(signingInput).digest()
  );
  if (!timingSafeEqualStr(parts[2], expectedSig)) throw new Error('Invalid token signature');

  const payloadJson = base64urlDecodeToString(parts[1]);
  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e) {
    throw new Error('Invalid token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload && typeof payload.exp !== 'undefined' && Number(payload.exp) <= now) {
    throw new Error('Token expired');
  }
  return payload;
}

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
  try {
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
