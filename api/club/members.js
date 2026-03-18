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
      return sendJson(res, 200, { members: [] });
    }
    const sql = getSql();
    if (!sql) throw new Error('Missing Neon connection config');
    const rows = await sql`
      SELECT
        cm.user_id,
        COALESCE(u.username, cm.user_id) AS username,
        cm.rank_key,
        cm.joined_at,
        cm.loyalty_score,
        cm.activity_score,
        cm.weekly_cash_contributed,
        cm.weekly_ops_completed,
        cm.last_activity_at
      FROM public.club_members cm
      LEFT JOIN public.users u
        ON u.user_id = cm.user_id
      WHERE cm.club_id = ${clubHome.club_id}
        AND cm.is_active = true
      ORDER BY cm.joined_at ASC
    `;
    cors(res, 'GET, OPTIONS');
    return sendJson(res, 200, { members: rows || [] });
  } catch (e) {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

