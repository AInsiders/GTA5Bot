/**
 * Vercel serverless: GET /api/stats/leaderboard?type=net_worth|cash|chips|level|rep|bank&limit=100
 * Returns leaderboard rows from Neon.
 * Supports: NEON_REST_URL + NEON_API_KEY (or NEON_JWT), or DATABASE_URL.
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

async function fetchViaRest(base, key, lbType, limit) {
  const url = base + '/rpc/get_leaderboard_top';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'apikey': key,
    },
    body: JSON.stringify({ leaderboard_type: lbType, limit_count: limit }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText || 'RPC failed');
  }
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    rank: r.rank != null ? Number(r.rank) : null,
    user_id: r.user_id,
    value: r.value != null ? Number(r.value) : null,
    display: r.display,
  }));
}

async function fetchViaDriver(connectionString, lbType, limit) {
  const sql = neon(connectionString);
  const rows = await sql`SELECT * FROM get_leaderboard_top(${lbType}, ${limit})`;
  return (rows || []).map((r) => ({
    rank: r.rank != null ? Number(r.rank) : null,
    user_id: r.user_id,
    value: r.value != null ? Number(r.value) : null,
    display: r.display,
  }));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    cors(res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = (req.query && req.query.type) || 'net_worth';
  const limit = Math.min(parseInt(req.query && req.query.limit, 10) || 100, 100);
  const lbType = type === 'notorious' ? 'rep' : type;

  const rest = getRestConfig();
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!rest && !connectionString) {
    cors(res);
    return res.status(500).json({ error: 'Set NEON_REST_URL + NEON_API_KEY (or NEON_JWT), or DATABASE_URL' });
  }

  try {
    const out = rest
      ? await fetchViaRest(rest.base, rest.key, lbType, limit)
      : await fetchViaDriver(connectionString, lbType, limit);
    cors(res);
    return res.status(200).json(out);
  } catch (e) {
    cors(res);
    return res.status(500).json({ error: e.message || 'Database error' });
  }
};
