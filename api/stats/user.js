/**
 * Vercel serverless: GET /api/stats/user
 * Returns the authenticated user's game stats from Neon (same DB as /api/stats/global).
 * Connection: DATABASE_URL or NEON_DATABASE_URL (same as global.js).
 * Requires Bearer token (JWT). Uses user id from JWT to fetch from users table + get_user_activity_stats().
 */
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

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

function cors(res) {
  // Match global stats: allow any origin so dashboard works from GitHub Pages or Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
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

function buildEmptyResponse(userId, payload) {
  return {
    id: userId,
    username: payload.username || payload.global_name || '',
    cash: 0,
    bank: 0,
    bank_balance: 0,
    chips: 0,
    net_worth: 0,
    rep: 0,
    level: 1,
    rank: 'Thug',
    level_title: 'Rank 1',
    wanted_level: 0,
    total_cash_earned: 0,
    total_rp: 0,
    rp_to_next_level: 0,
    level_progress_percentage: 0,
    total_level_ups: 0,
    highest_level_reached: 1,
    daily_streak: 0,
    created_at: null,
    last_activity: null,
    playing_since: null,
    inventory: [],
    vehicles: [],
    properties: [],
    businesses: {},
    mc_businesses: {},
    warehouse_data: {},
    nightclub: {},
    vehicle_warehouse: [],
    cargo_warehouse: [],
    stolen_cars: [],
    banking_stats: {},
    casino_stats: {},
    trivia_stats: {},
    lockpick_stats: {},
    game_statistics: {},
    counts: { inventory: 0, vehicles: 0, properties: 0, businesses: 0, mc_businesses: 0, vehicle_warehouse: 0, cargo_warehouse: 0, stolen_cars: 0 },
    activity_stats: {},
  };
}

async function fetchUserFromDb(connectionString, userId) {
  const sql = neon(connectionString);
  // Use SELECT * to stay resilient to schema changes (missing/extra columns) across bot versions.
  // The response below only picks the fields it needs.
  const rows = await sql`SELECT * FROM users WHERE user_id = ${userId} LIMIT 1`;
  return (rows && rows[0]) || null;
}

async function fetchActivityStats(connectionString, userId) {
  try {
    const sql = neon(connectionString);
    const rows = await sql`SELECT get_user_activity_stats(${userId}) AS data`;
    const raw = rows && rows[0] && rows[0].data;
    if (raw && typeof raw === 'object') return raw;
    if (typeof raw === 'string') return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

module.exports = async function handler(req, res) {
  try {
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

    const secret = (process.env.AUTH_JWT_SECRET || '').trim();
    if (!secret) {
      cors(res);
      return sendJson(res, 500, { error: 'Missing AUTH_JWT_SECRET' });
    }

    const token = getBearerToken(req);
    if (!token) {
      cors(res);
      return sendJson(res, 401, { error: 'Missing bearer token' });
    }

    const payload = verifyJwt(token, secret);
    const userId = String(payload.id || payload.sub || '');
    if (!userId) {
      cors(res);
      return sendJson(res, 401, { error: 'Invalid token: no user id' });
    }

    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!connectionString) {
      cors(res);
      return sendJson(res, 500, { error: 'Set DATABASE_URL or NEON_DATABASE_URL' });
    }

    const [row, activityStats] = await Promise.all([
      fetchUserFromDb(connectionString, userId),
      fetchActivityStats(connectionString, userId),
    ]);

    if (!row) {
      cors(res);
      return sendJson(res, 200, Object.assign(buildEmptyResponse(userId, payload), { activity_stats: activityStats || {} }));
    }

    const cash = Number(row.cash) || 0;
    const bank = Number(row.bank_balance) || 0;
    const chips = Number(row.chips) || 0;
    const netWorth = cash + bank + chips;

    const parseJson = (v) => {
      if (v == null) return null;
      if (typeof v === 'object') return v;
      try { return JSON.parse(String(v)); } catch (e) { return null; }
    };

    const inventory = parseJson(row.inventory);
    const vehicles = parseJson(row.vehicles);
    const properties = parseJson(row.properties);
    const businesses = parseJson(row.businesses);
    const mcBusinesses = parseJson(row.mc_businesses);
    const warehouseData = parseJson(row.warehouse_data);
    const nightclub = parseJson(row.nightclub);
    const vehicleWarehouse = parseJson(row.vehicle_warehouse);
    const cargoWarehouse = parseJson(row.cargo_warehouse);
    const stolenCars = parseJson(row.stolen_cars);
    const bankingStats = parseJson(row.banking_stats);
    const casinoStats = parseJson(row.casino_stats);
    const triviaStats = parseJson(row.trivia_stats);
    const lockpickStats = parseJson(row.lockpick_stats);
    const gameStats = parseJson(row.game_statistics);

    const ownedBusinesses = (businesses && businesses.owned_businesses) || [];
    const mcCount = (() => {
      if (!mcBusinesses || typeof mcBusinesses !== 'object') return 0;
      const arr = mcBusinesses.owned_businesses || mcBusinesses.owned;
      if (Array.isArray(arr)) return arr.length;
      const keys = Object.keys(mcBusinesses).filter(k => !['owned', 'owned_businesses', 'active_businesses'].includes(k) && mcBusinesses[k] && typeof mcBusinesses[k] === 'object');
      return keys.length;
    })();

    cors(res);
    return sendJson(res, 200, {
      id: row.user_id,
      username: row.username || payload.username || payload.global_name || '',
      cash,
      bank,
      bank_balance: bank,
      chips,
      net_worth: netWorth,
      rep: Number(row.rep) || 0,
      level: Number(row.level) || 1,
      rank: row.rank || 'Thug',
      level_title: row.level_title || 'Rank 1',
      wanted_level: Number(row.wanted_level) || 0,
      total_cash_earned: Number(row.total_cash_earned ?? row.total_cash_earned_from_levels) || 0,
      total_rp: Number(row.total_rp) || 0,
      rp_to_next_level: Number(row.rp_to_next_level) || 0,
      level_progress_percentage: Number(row.level_progress_percentage) || 0,
      total_level_ups: Number(row.total_level_ups) || 0,
      highest_level_reached: Number(row.highest_level_reached) || 1,
      total_cash_earned_from_levels: Number(row.total_cash_earned_from_levels) || 0,
      daily_streak: Number(row.daily_streak) || 0,
      daily_last_claim_at: row.daily_last_claim_at,
      leaderboard_position: row.leaderboard_position != null ? Number(row.leaderboard_position) : null,
      rank_display: row.rank_display || null,
      created_at: row.created_at,
      last_activity: row.last_activity,
      tos_accepted_at: row.tos_accepted_at,
      playing_since: row.created_at,
      inventory: Array.isArray(inventory) ? inventory : [],
      vehicles: Array.isArray(vehicles) ? vehicles : [],
      properties: Array.isArray(properties) ? properties : [],
      businesses: businesses || {},
      mc_businesses: mcBusinesses || {},
      warehouse_data: warehouseData || {},
      nightclub: nightclub || {},
      vehicle_warehouse: Array.isArray(vehicleWarehouse) ? vehicleWarehouse : [],
      cargo_warehouse: Array.isArray(cargoWarehouse) ? cargoWarehouse : [],
      stolen_cars: Array.isArray(stolenCars) ? stolenCars : [],
      banking_stats: bankingStats || {},
      casino_stats: casinoStats || {},
      trivia_stats: triviaStats || {},
      lockpick_stats: lockpickStats || {},
      game_statistics: gameStats || {},
      counts: {
        inventory: Array.isArray(inventory) ? inventory.length : 0,
        vehicles: Array.isArray(vehicles) ? vehicles.length : 0,
        properties: Array.isArray(properties) ? properties.length : 0,
        businesses: Array.isArray(ownedBusinesses) ? ownedBusinesses.length : 0,
        mc_businesses: mcCount,
        vehicle_warehouse: (() => {
          if (!vehicleWarehouse) return 0;
          if (Array.isArray(vehicleWarehouse)) return vehicleWarehouse.length;
          const v = vehicleWarehouse.vehicles;
          if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).reduce((s, n) => s + (Number(n) || 0), 0);
          return 0;
        })(),
        cargo_warehouse: (() => {
          if (!cargoWarehouse) return 0;
          if (Array.isArray(cargoWarehouse)) return cargoWarehouse.length;
          const c = Number(cargoWarehouse.crates);
          return isNaN(c) ? 0 : c;
        })(),
        stolen_cars: Array.isArray(stolenCars) ? stolenCars.length : 0,
      },
      activity_stats: activityStats || {},
    });
  } catch (e) {
    cors(res);
    return sendJson(res, 401, { error: (e && e.message) ? e.message : 'Auth failed' });
  }
};
