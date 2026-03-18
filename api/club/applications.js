const {
  cors,
  sendJson,
  requireUserId,
  fetchClubHome,
  getSql,
  normalizeErrorStatus,
} = require('../../lib/site-api');

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    cors(res, 'GET, OPTIONS');
    res.statusCode = 204;
    return res.end();
  }
  if (method !== 'GET') {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const auth = requireUserId(req);
    const clubHome = await fetchClubHome(auth.userId);
    if (!clubHome || !clubHome.club_id) {
      cors(res, 'GET, OPTIONS');
      return sendJson(res, 200, { applications: [] });
    }
    const sql = getSql();
    if (!sql) throw new Error('Missing Neon connection config');
    const rows = await sql`
      SELECT
        ca.application_id,
        ca.user_id,
        COALESCE(u.username, ca.user_id) AS username,
        ca.message,
        ca.status,
        ca.created_at,
        u.level,
        u.rep
      FROM public.club_applications ca
      LEFT JOIN public.users u
        ON u.user_id = ca.user_id
      WHERE ca.club_id = ${clubHome.club_id}
        AND ca.status = 'pending'
      ORDER BY ca.created_at ASC
    `;
    cors(res, 'GET, OPTIONS');
    return sendJson(res, 200, { applications: rows || [] });
  } catch (e) {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

