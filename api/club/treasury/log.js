const {
  cors,
  sendJson,
  requireUserId,
  fetchClubHome,
  getSql,
  normalizeErrorStatus,
} = require('../../../lib/site-api');

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
      return sendJson(res, 200, { entries: [] });
    }
    const sql = getSql();
    if (!sql) throw new Error('Missing Neon connection config');
    const rows = await sql`
      SELECT
        ctl.entry_id,
        ctl.actor_user_id,
        COALESCE(u.username, ctl.actor_user_id) AS actor_username,
        ctl.entry_type,
        ctl.amount,
        ctl.balance_after,
        ctl.description,
        ctl.metadata,
        ctl.created_at
      FROM public.club_treasury_ledger ctl
      LEFT JOIN public.users u
        ON u.user_id = ctl.actor_user_id
      WHERE ctl.club_id = ${clubHome.club_id}
      ORDER BY ctl.created_at DESC
      LIMIT 25
    `;
    cors(res, 'GET, OPTIONS');
    return sendJson(res, 200, { entries: rows || [] });
  } catch (e) {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

