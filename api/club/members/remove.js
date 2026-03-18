const {
  cors,
  sendJson,
  requireUserId,
  parseBody,
  fetchClubHome,
  OFFICER_RANKS,
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
    if (OFFICER_RANKS.indexOf(String(clubHome.rank_key || '')) === -1) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 403, { error: 'Your club rank does not allow member removal.' });
    }
    const body = parseBody(req);
    if (!body.target_user_id) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 400, { error: 'Missing target_user_id' });
    }
    const params = {
      p_club_id: clubHome.club_id,
      p_actor_user_id: auth.userId,
      p_target_user_id: String(body.target_user_id),
      p_leave_reason: body.leave_reason != null ? String(body.leave_reason) : 'removed',
      p_notes: body.notes != null ? String(body.notes) : '',
      p_add_to_blacklist: !!body.add_to_blacklist,
    };
    let result;
    if (getRestConfig()) {
      const rows = await callRpcRest('remove_club_member', params);
      result = Array.isArray(rows) ? rows[0] || null : rows;
    } else {
      const sql = getSql();
      if (!sql) throw new Error('Missing Neon connection config');
      const rows = await sql`
        SELECT * FROM remove_club_member(
          ${params.p_club_id},
          ${params.p_actor_user_id},
          ${params.p_target_user_id},
          ${params.p_leave_reason},
          ${params.p_notes},
          ${params.p_add_to_blacklist}
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

