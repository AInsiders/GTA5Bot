const {
  cors,
  sendJson,
  requireUserId,
  parseBody,
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
    const body = parseBody(req);
    if (!body.invite_id || typeof body.accept !== 'boolean') {
      cors(res, 'POST, OPTIONS');
      return sendJson(res, 400, { error: 'Missing invite_id or accept' });
    }
    const params = {
      p_invite_id: String(body.invite_id),
      p_user_id: auth.userId,
      p_accept: body.accept,
    };
    let result;
    if (getRestConfig()) {
      const rows = await callRpcRest('respond_to_club_invite', params);
      result = Array.isArray(rows) ? rows[0] || null : rows;
    } else {
      const sql = getSql();
      if (!sql) throw new Error('Missing Neon connection config');
      const rows = await sql`
        SELECT * FROM respond_to_club_invite(
          ${params.p_invite_id},
          ${params.p_user_id},
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

