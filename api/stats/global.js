/**
 * Vercel serverless: GET /api/stats/global
 * Returns global stats from Neon.
 * Supports: (1) Neon Data API REST via NEON_REST_URL + NEON_API_KEY, or (2) DATABASE_URL with @neondatabase/serverless.
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

async function fetchViaRest(base, key) {
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText || 'RPC failed');
  }
  const raw = await res.json();
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.data !== undefined) return raw.data;
    if (typeof raw.total_users !== 'undefined') return raw;
  }
  if (Array.isArray(raw) && raw[0]) {
    if (raw[0].data !== undefined) return raw[0].data;
    if (typeof raw[0].total_users !== 'undefined') return raw[0];
  }
  return raw || {};
}

async function fetchViaDriver(connectionString) {
  const sql = neon(connectionString);
  const rows = await sql`SELECT get_website_global_stats() AS data`;
  const raw = (rows && rows[0] && rows[0].data) || null;
  return raw && typeof raw === 'object' ? raw : (typeof raw === 'string' ? JSON.parse(raw) : {});
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
    return sendJson(res, 500, { error: 'Set NEON_REST_URL + NEON_API_KEY (or NEON_JWT), or DATABASE_URL' });
  }

  try {
    const data = rest
      ? await fetchViaRest(rest.base, rest.key)
      : await fetchViaDriver(connectionString);
    cors(res);
    return sendJson(res, 200, data || {});
  } catch (e) {
    cors(res);
    return sendJson(res, 500, { error: (e && e.message) || 'Database error' });
  }
};
