/**
 * Vercel serverless:
 * - GET /api/dashboard/garage       → normalized garage view for dashboard
 * - POST /api/dashboard/garage/reorder → persist reordered garage_slots
 *
 * Uses the same Neon + JWT setup as /api/stats/user:
 * - AUTH_JWT_SECRET for Discord session JWT verification
 * - NEON_REST_URL + NEON_API_KEY (or NEON_JWT), or DATABASE_URL / NEON_DATABASE_URL
 */
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

function getRestConfig() {
  const base = (process.env.NEON_REST_URL || '').replace(/\/$/, '');
  const key = process.env.NEON_API_KEY || process.env.NEON_JWT || '';
  return base && key ? { base, key } : null;
}

async function fetchUserStatsViaRest(base, key, userId) {
  const url = base + '/rpc/get_website_user_stats';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'apikey': key,
    },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText || 'REST user stats fetch failed');
  }
  const raw = await res.json();
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  if (raw && typeof raw === 'object' && raw.data !== undefined) return raw.data;
  return raw;
}

async function fetchUserStatsFromDb(connectionString, userId) {
  const sql = neon(connectionString);
  const rows = await sql`SELECT get_website_user_stats(${userId}) AS data`;
  const raw = rows && rows[0] && rows[0].data;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') return JSON.parse(raw);
  return null;
}

async function callSetUserGarageSlotsViaRest(base, key, userId, slotsJson) {
  const url = base + '/rpc/set_user_garage_slots';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'apikey': key,
    },
    body: JSON.stringify({ p_user_id: userId, p_slots: slotsJson }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText || 'REST garage_slots update failed');
  }
  const raw = await res.json();
  if (Array.isArray(raw)) return raw[0] || raw;
  if (raw && typeof raw === 'object' && raw.data !== undefined) return raw.data;
  return raw;
}

async function callSetUserGarageSlotsViaDriver(connectionString, userId, slotsJson) {
  const sql = neon(connectionString);
  const rows = await sql`SELECT set_user_garage_slots(${userId}, ${slotsJson}) AS data`;
  const raw = rows && rows[0] && rows[0].data;
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
}

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

function parseBody(req) {
  // Vercel / Node 18: body may already be parsed or may be a string
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'object') return b;
  try {
    return JSON.parse(String(b));
  } catch (e) {
    return {};
  }
}

function normalizeGarageResponse(row) {
  const parseJson = (v) => {
    if (v == null) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(String(v)); } catch (e) { return null; }
  };
  const rawSlots = parseJson(row.garage_slots) || [];
  const slots = [];
  if (Array.isArray(rawSlots)) {
    for (let i = 0; i < rawSlots.length; i++) {
      const ent = rawSlots[i];
      if (ent && typeof ent === 'object') {
        slots.push({
          slotIndex: i,
          vehicle: ent.vehicle || null,
          purchase_price: ent.purchase_price != null ? Number(ent.purchase_price) : null,
          rarity: ent.rarity || null,
          vehicle_type: ent.vehicle_type || null,
          car_code: ent.car_code || null,
          raw: ent,
        });
      } else {
        slots.push({
          slotIndex: i,
          vehicle: null,
          purchase_price: null,
          rarity: null,
          vehicle_type: null,
          car_code: null,
          raw: null,
        });
      }
    }
  }

  return {
    garages: [
      {
        garageId: 'main',
        title: 'Main Garage',
        slots,
      },
    ],
    meta: {
      total_slots: slots.length,
      used_slots: slots.filter(s => s && s.vehicle).length,
    },
  };
}

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }

  if (method !== 'GET' && method !== 'POST') {
    cors(res);
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
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

    const rest = getRestConfig();
    const connectionString = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
    if (!rest && !connectionString) {
      cors(res);
      return sendJson(res, 500, { error: 'Set NEON_REST_URL + NEON_API_KEY (same as global stats), or DATABASE_URL / NEON_DATABASE_URL' });
    }

    if (method === 'GET') {
      const row = rest
        ? await fetchUserStatsViaRest(rest.base, rest.key, userId)
        : await fetchUserStatsFromDb(connectionString, userId);
      if (!row) {
        cors(res);
        return sendJson(res, 200, { garages: [], meta: { total_slots: 0, used_slots: 0 } });
      }
      const normalized = normalizeGarageResponse(row);
      cors(res);
      return sendJson(res, 200, normalized);
    }

    // POST: persist new garage_slots ordering
    const body = parseBody(req);
    const garages = Array.isArray(body.garages) ? body.garages : null;
    if (!garages || garages.length === 0) {
      cors(res);
      return sendJson(res, 400, { error: 'Missing garages payload' });
    }

    const main = garages[0] || {};
    const slotsArr = Array.isArray(main.slots) ? main.slots : [];

    const currentRow = rest
      ? await fetchUserStatsViaRest(rest.base, rest.key, userId)
      : await fetchUserStatsFromDb(connectionString, userId);
    if (!currentRow) {
      cors(res);
      return sendJson(res, 400, { error: 'No existing garage_slots for user' });
    }

    const parseJson = (v) => {
      if (v == null) return null;
      if (typeof v === 'object') return v;
      try { return JSON.parse(String(v)); } catch (e) { return null; }
    };

    const existingSlots = parseJson(currentRow.garage_slots) || [];
    const existingLen = Array.isArray(existingSlots) ? existingSlots.length : 0;
    const newLen = slotsArr.length;

    if (existingLen !== newLen) {
      cors(res);
      return sendJson(res, 400, { error: `Slot layout length mismatch (expected ${existingLen}, got ${newLen})` });
    }

    const newSlotsJson = slotsArr.map((s) => (s && typeof s.raw === 'object' ? s.raw : null));

    const updatedSlots = rest
      ? await callSetUserGarageSlotsViaRest(rest.base, rest.key, userId, newSlotsJson)
      : await callSetUserGarageSlotsViaDriver(connectionString, userId, newSlotsJson);

    const updatedRow = Object.assign({}, currentRow, { garage_slots: updatedSlots });
    const normalized = normalizeGarageResponse(updatedRow);
    cors(res);
    return sendJson(res, 200, normalized);
  } catch (e) {
    const msg = (e && e.message) ? e.message : 'Request failed';
    const isAuthError = /token|missing bearer|invalid token|expired|no user id/i.test(msg);
    const status = isAuthError ? 401 : 500;
    cors(res);
    return sendJson(res, status, { error: isAuthError ? msg : 'Garage API error. Ensure Neon REST/connection string and set_user_garage_slots are configured.' });
  }
};

