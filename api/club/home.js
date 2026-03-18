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
    if (clubHome && clubHome.club_id) {
      const sql = getSql();
      if (sql) {
        const rows = await sql`
          SELECT
            name,
            tag,
            bio,
            motto,
            is_public,
            recruitment_open,
            join_policy
          FROM public.clubs
          WHERE club_id = ${clubHome.club_id}
            AND disbanded_at IS NULL
          LIMIT 1
        `;
        if (rows && rows[0]) {
          clubHome.bio = rows[0].bio;
          clubHome.motto = rows[0].motto;
          clubHome.is_public = rows[0].is_public;
          clubHome.recruitment_open = rows[0].recruitment_open;
          clubHome.join_policy = rows[0].join_policy;
          clubHome.club_name = rows[0].name || clubHome.club_name;
          clubHome.club_tag = rows[0].tag || clubHome.club_tag;
        }
      }
    }
    cors(res, 'GET, OPTIONS');
    return sendJson(res, 200, { club_home: clubHome || null });
  } catch (e) {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

