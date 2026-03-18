const {
  cors,
  sendJson,
  requireUserId,
  parseBody,
  fetchClubHome,
  RANK_MANAGE_RANKS,
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
    if (RANK_MANAGE_RANKS.indexOf(String(clubHome.rank_key || '')) === -1) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 403, { error: 'Your club rank does not allow rank changes.' });
    }
    const body = parseBody(req);
    if (!body.target_user_id || !body.new_rank_key) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 400, { error: 'Missing target_user_id or new_rank_key' });
    }
    const params = {
      p_club_id: clubHome.club_id,
      p_actor_user_id: auth.userId,
      p_target_user_id: String(body.target_user_id),
      p_new_rank_key: String(body.new_rank_key),
    };
    let result;
    if (getRestConfig()) {
      const rows = await callRpcRest('change_club_rank', params);
      result = Array.isArray(rows) ? rows[0] || null : rows;
    } else {
      const sql = getSql();
      if (!sql) throw new Error('Missing Neon connection config');
      const rows = await sql`
        SELECT * FROM change_club_rank(
          ${params.p_club_id},
          ${params.p_actor_user_id},
          ${params.p_target_user_id},
          ${params.p_new_rank_key}
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

