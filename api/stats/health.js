/**
 * Vercel serverless: GET /api/stats/health
 * Checks Neon connectivity. Supports NEON_REST_URL + NEON_API_KEY or DATABASE_URL.
 */
const { neon } = require('@neondatabase/serverless');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

function getRestConfig() {
  const base = (process.env.NEON_REST_URL || '').replace(/\/$/, '');
  const key = process.env.NEON_API_KEY || process.env.NEON_JWT || '';
  return base && key ? { base, key } : null;
}

async function checkRest(base, key) {
  const url = base + '/rpc/get_website_global_stats';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'apikey': key,
    },
    body: JSON.stringify({}),
  });
  return res.ok;
}

async function checkDriver(connectionString) {
  const sql = neon(connectionString);
  await sql`SELECT 1`;
  return true;
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (method !== 'GET') {
    cors(res);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const rest = getRestConfig();
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!rest && !connectionString) {
    cors(res);
    return sendJson(res, 503, { ok: false, error: 'Set NEON_REST_URL + NEON_API_KEY (or NEON_JWT), or DATABASE_URL' });
  }

  try {
    const ok = rest ? await checkRest(rest.base, rest.key) : await checkDriver(connectionString);
    cors(res);
    return sendJson(res, 200, { ok: !!ok, neon: 'connected' });
  } catch (e) {
    cors(res);
    return sendJson(res, 503, { ok: false, error: (e && e.message) || 'Database error' });
  }
};
