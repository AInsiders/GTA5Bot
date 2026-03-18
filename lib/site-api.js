const { neon } = require('@neondatabase/serverless');
const { verifyJwt } = require('./jwt');

const OFFICER_RANKS = ['president', 'vice_president', 'road_captain', 'treasurer', 'recruiter', 'enforcer'];
const INVITE_RANKS = ['president', 'vice_president', 'road_captain', 'recruiter'];
const RANK_MANAGE_RANKS = ['president', 'vice_president'];

function cors(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods || 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getBearerToken(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function requireUserId(req) {
  const secret = (process.env.AUTH_JWT_SECRET || '').trim();
  if (!secret) throw new Error('Missing AUTH_JWT_SECRET');
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');
  const payload = verifyJwt(token, secret);
  const userId = String(payload.id || payload.sub || '');
  if (!userId) throw new Error('Invalid token: no user id');
  return { userId, payload };
}

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch (e) {
    return {};
  }
}

function getRestConfig() {
  const base = (process.env.NEON_REST_URL || '').replace(/\/$/, '');
  const key = process.env.NEON_API_KEY || process.env.NEON_JWT || '';
  return base && key ? { base, key } : null;
}

function getConnectionString() {
  return (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
}

function getSql() {
  const connectionString = getConnectionString();
  if (!connectionString) return null;
  return neon(connectionString);
}

async function callRpcRest(name, params) {
  const rest = getRestConfig();
  if (!rest) throw new Error('Missing Neon REST config');
  const res = await fetch(rest.base + '/rpc/' + name, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + rest.key,
      'apikey': rest.key,
    },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText || ('RPC failed: ' + name));
  }
  const raw = await res.json();
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && raw.data !== undefined) return raw.data;
  return raw;
}

async function fetchClubHome(userId) {
  const rest = getRestConfig();
  if (rest) {
    const rows = await callRpcRest('get_club_home', { p_user_id: userId });
    if (Array.isArray(rows)) return rows[0] || null;
    return rows || null;
  }
  const sql = getSql();
  if (!sql) throw new Error('Missing Neon connection config');
  const rows = await sql`SELECT * FROM get_club_home(${userId})`;
  return (rows && rows[0]) || null;
}

async function fetchWebsiteUserStats(userId) {
  const rest = getRestConfig();
  if (rest) {
    const raw = await callRpcRest('get_website_user_stats', { p_user_id: userId });
    if (Array.isArray(raw)) return raw[0] || null;
    return raw || null;
  }
  const sql = getSql();
  if (!sql) throw new Error('Missing Neon connection config');
  const rows = await sql`SELECT get_website_user_stats(${userId}) AS data`;
  const raw = rows && rows[0] && rows[0].data;
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw || null;
}

function normalizeErrorStatus(message) {
  return /token|missing bearer|invalid token|expired|no user id/i.test(String(message || '')) ? 401 : 500;
}

module.exports = {
  OFFICER_RANKS,
  INVITE_RANKS,
  RANK_MANAGE_RANKS,
  cors,
  sendJson,
  getBearerToken,
  requireUserId,
  parseBody,
  getRestConfig,
  getConnectionString,
  getSql,
  callRpcRest,
  fetchClubHome,
  fetchWebsiteUserStats,
  normalizeErrorStatus,
};

