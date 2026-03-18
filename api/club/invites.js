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
    const sql = getSql();
    if (!sql) throw new Error('Missing Neon connection config');

    const incoming = await sql`
      SELECT
        ci.invite_id,
        ci.club_id,
        ci.inviter_user_id,
        COALESCE(inv.username, ci.inviter_user_id) AS inviter_username,
        ci.message,
        ci.status,
        ci.expires_at,
        ci.created_at,
        c.name AS club_name,
        c.tag AS club_tag
      FROM public.club_invites ci
      JOIN public.clubs c
        ON c.club_id = ci.club_id
      LEFT JOIN public.users inv
        ON inv.user_id = ci.inviter_user_id
      WHERE ci.invited_user_id = ${auth.userId}
        AND ci.status = 'pending'
        AND ci.expires_at > NOW()
      ORDER BY ci.expires_at ASC
    `;

    let outgoing = [];
    if (clubHome && clubHome.club_id) {
      outgoing = await sql`
        SELECT
          ci.invite_id,
          ci.club_id,
          ci.inviter_user_id,
          ci.invited_user_id,
          COALESCE(u.username, ci.invited_user_id) AS invited_username,
          ci.message,
          ci.status,
          ci.expires_at,
          ci.created_at
        FROM public.club_invites ci
        LEFT JOIN public.users u
          ON u.user_id = ci.invited_user_id
        WHERE ci.club_id = ${clubHome.club_id}
          AND ci.status = 'pending'
          AND ci.expires_at > NOW()
        ORDER BY ci.created_at DESC
      `;
    }

    cors(res, 'GET, OPTIONS');
    return sendJson(res, 200, { incoming: incoming || [], outgoing: outgoing || [] });
  } catch (e) {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

