/**
 * Vercel serverless: GET /api/stats/club-leaderboard?category=reputation|treasury|level|prestige|members|war&limit=100
 * Returns club leaderboard from Neon (get_club_leaderboard_page).
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

async function fetchViaRest(base, key, category, limit, offset) {
  const url = base + '/rpc/get_club_leaderboard_page';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'apikey': key,
    },
    body: JSON.stringify({
      p_category: category || 'reputation',
      p_limit: limit,
      p_offset: offset || 0,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText || 'RPC failed');
  }
  const raw = await res.json();
  let rows = [];
  if (Array.isArray(raw)) rows = raw;
  else if (raw && typeof raw === 'object' && Array.isArray(raw.data)) rows = raw.data;
  else if (raw && typeof raw === 'object' && raw.rows) rows = raw.rows;
  return rows.map((r, i) => ({
    rank: i + 1,
    club_id: r.club_id,
    club_name: r.club_name || r.name,
    club_tag: r.club_tag || r.tag,
    level: r.level != null ? Number(r.level) : 0,
    prestige_tier: r.prestige_tier != null ? Number(r.prestige_tier) : 0,
    member_count: r.member_count != null ? Number(r.member_count) : 0,
    treasury_cash: r.treasury_cash != null ? Number(r.treasury_cash) : 0,
    reputation: r.reputation != null ? Number(r.reputation) : 0,
    club_xp: r.club_xp != null ? Number(r.club_xp) : 0,
    wins: r.wins != null ? Number(r.wins) : 0,
    losses: r.losses != null ? Number(r.losses) : 0,
  }));
}

async function fetchViaDriver(connectionString, category, limit, offset) {
  const sql = neon(connectionString);
  const rows = await sql`SELECT * FROM get_club_leaderboard_page(${category || 'reputation'}, ${limit}, ${offset || 0})`;
  return (rows || []).map((r, i) => ({
    rank: i + 1,
    club_id: r.club_id,
    club_name: r.club_name || r.name,
    club_tag: r.club_tag || r.tag,
    level: r.level != null ? Number(r.level) : 0,
    prestige_tier: r.prestige_tier != null ? Number(r.prestige_tier) : 0,
    member_count: r.member_count != null ? Number(r.member_count) : 0,
    treasury_cash: r.treasury_cash != null ? Number(r.treasury_cash) : 0,
    reputation: r.reputation != null ? Number(r.reputation) : 0,
    club_xp: r.club_xp != null ? Number(r.club_xp) : 0,
    wins: r.wins != null ? Number(r.wins) : 0,
    losses: r.losses != null ? Number(r.losses) : 0,
  }));
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getQuery(req) {
  try {
    const q = req.query;
    if (q && typeof q === 'object') return q;
    const url = req.url || '';
    const i = url.indexOf('?');
    if (i < 0) return {};
    const params = {};
    new URLSearchParams(url.slice(i)).forEach((v, k) => { params[k] = v; });
    return params;
  } catch (e) {
    return {};
  }
}

const VALID_CATEGORIES = ['reputation', 'treasury', 'level', 'prestige', 'members', 'war'];

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

  const query = getQuery(req);
  const category = VALID_CATEGORIES.includes(String(query.category || '').toLowerCase())
    ? String(query.category).toLowerCase()
    : 'reputation';
  const limit = Math.min(parseInt(query.limit, 10) || 100, 100);
  const offset = Math.max(0, parseInt(query.offset, 10) || 0);

  const rest = getRestConfig();
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!rest && !connectionString) {
    cors(res);
    return sendJson(res, 500, { error: 'Set NEON_REST_URL + NEON_API_KEY (or NEON_JWT), or DATABASE_URL' });
  }

  try {
    const rows = rest
      ? await fetchViaRest(rest.base, rest.key, category, limit, offset)
      : await fetchViaDriver(connectionString, category, limit, offset);
    cors(res);
    return sendJson(res, 200, rows);
  } catch (e) {
    cors(res);
    return sendJson(res, 500, { error: (e && e.message) || 'Database error' });
  }
};
