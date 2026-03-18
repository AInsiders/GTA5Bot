const {
  cors,
  sendJson,
  requireUserId,
  parseBody,
  fetchClubHome,
  callRpcRest,
  getRestConfig,
  getSql,
  normalizeErrorStatus,
} = require('../../lib/site-api');

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
    if (String(clubHome.rank_key || '') !== 'president') {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 403, { error: 'Only the President can change club identity settings.' });
    }
    const body = parseBody(req);
    const params = {
      p_club_id: clubHome.club_id,
      p_actor_user_id: auth.userId,
      p_name: body.name != null ? body.name : null,
      p_tag: body.tag != null ? body.tag : null,
      p_bio: body.bio != null ? body.bio : null,
      p_motto: body.motto != null ? body.motto : null,
      p_is_public: typeof body.is_public === 'boolean' ? body.is_public : null,
      p_recruitment_open: typeof body.recruitment_open === 'boolean' ? body.recruitment_open : null,
      p_join_policy: body.join_policy != null ? body.join_policy : null,
    };
    let result;
    if (getRestConfig()) {
      const rows = await callRpcRest('set_club_identity', params);
      result = Array.isArray(rows) ? rows[0] || null : rows;
    } else {
      const sql = getSql();
      if (!sql) throw new Error('Missing Neon connection config');
      const rows = await sql`
        SELECT * FROM set_club_identity(
          ${params.p_club_id},
          ${params.p_actor_user_id},
          ${params.p_name},
          ${params.p_tag},
          ${params.p_bio},
          ${params.p_motto},
          ${params.p_is_public},
          ${params.p_recruitment_open},
          ${params.p_join_policy}
        )
      `;
      result = rows && rows[0] ? rows[0] : null;
    }
    cors(res, 'POST, OPTIONS');
    return sendJson(res, 200, { club: result });
  } catch (e) {
    cors(res, 'POST, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

