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
      return sendJson(res, 403, { error: 'Your club rank does not allow sending invites.' });
    }
    const body = parseBody(req);
    if (!body.target_user_id) {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 400, { error: 'Missing target_user_id' });
    }
    const params = {
      p_club_id: clubHome.club_id,
      p_actor_user_id: auth.userId,
      p_invited_user_id: String(body.target_user_id),
      p_message: body.message != null ? String(body.message) : '',
      p_expires_hours: body.expires_hours != null ? Number(body.expires_hours) : 48,
    };
    let result;
    if (getRestConfig()) {
      const rows = await callRpcRest('invite_to_club', params);
      result = Array.isArray(rows) ? rows[0] || null : rows;
    } else {
      const sql = getSql();
      if (!sql) throw new Error('Missing Neon connection config');
      const rows = await sql`
        SELECT * FROM invite_to_club(
          ${params.p_club_id},
          ${params.p_actor_user_id},
          ${params.p_invited_user_id},
          ${params.p_message},
          ${params.p_expires_hours}
        )
      `;
      result = rows && rows[0] ? rows[0] : null;
    }
    cors(res, 'POST, OPTIONS');
    return sendJson(res, 200, { invite: result });
  } catch (e) {
    cors(res, 'POST, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

