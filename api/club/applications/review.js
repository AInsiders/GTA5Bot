const {
  cors,
  sendJson,
  requireUserId,
  parseBody,
  fetchClubHome,
  INVITE_RANKS,
  callRpcRest,
  getRestConfig,
  getSql,
  normalizeErrorStatus,
} = require('../../../lib/site-api');

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'POST').toUpperCase();
  if (method === 'OPTIONS') {
    cors(res, 'POST, OPTIONS');
    res.statusCode = 204;
    return res.end();
  }
  if (method !== 'POST') {
    cors(res, 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const auth = requireUserId(req);
    const clubHome = await fetchClubHome(auth.userId);
    if (!clubHome || !clubHome.club_id) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 403, { error: 'You are not currently in an MC club.' });
    }
    if (INVITE_RANKS.indexOf(String(clubHome.rank_key || '')) === -1) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 403, { error: 'Your club rank does not allow application review.' });
    }
    const body = parseBody(req);
    if (!body.application_id || typeof body.accept !== 'boolean') {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 400, { error: 'Missing application_id or accept' });
    }
    const params = {
      p_application_id: String(body.application_id),
      p_actor_user_id: auth.userId,
      p_accept: body.accept,
    };
    let result;
    if (getRestConfig()) {
      const rows = await callRpcRest('review_club_application', params);
      result = Array.isArray(rows) ? rows[0] || null : rows;
    } else {
      const sql = getSql();
      if (!sql) throw new Error('Missing Neon connection config');
      const rows = await sql`
        SELECT * FROM review_club_application(
          ${params.p_application_id},
          ${params.p_actor_user_id},
          ${params.p_accept}
        )
      `;
      result = rows && rows[0] ? rows[0] : null;
    }
    cors(res, 'POST, OPTIONS');
    return sendJson(res, 200, { result });
  } catch (e) {
    cors(res, 'POST, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

