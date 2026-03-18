const {
  cors,
  sendJson,
  requireUserId,
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
    const sql = getSql();
    if (!sql) throw new Error('Server management requires DATABASE_URL / NEON_DATABASE_URL.');
    const rows = await sql`
      WITH explicit_admins AS (
        SELECT
          guild_id,
          guild_name,
          icon_url,
          is_owner,
          permissions,
          updated_at
        FROM public.server_admins
        WHERE user_id = ${auth.userId}
      ),
      inferred_admins AS (
        SELECT
          guild_id,
          ''::text AS guild_name,
          NULL::text AS icon_url,
          false AS is_owner,
          '["administrator"]'::jsonb AS permissions,
          MAX(created_at) AS updated_at
        FROM public.bot_interactions
        WHERE user_id = ${auth.userId}
          AND guild_id IS NOT NULL
          AND command_name = 'setlevelingchannel'
        GROUP BY guild_id
        UNION
        SELECT
          guild_id,
          ''::text AS guild_name,
          NULL::text AS icon_url,
          false AS is_owner,
          '["logging"]'::jsonb AS permissions,
          MAX(changed_at) AS updated_at
        FROM public.developer_log_audit
        WHERE changed_by = ${auth.userId}
          AND guild_id IS NOT NULL
        GROUP BY guild_id
      )
      SELECT DISTINCT ON (guild_id)
        guild_id,
        guild_name,
        icon_url,
        is_owner,
        permissions
      FROM (
        SELECT * FROM explicit_admins
        UNION ALL
        SELECT * FROM inferred_admins
      ) q
      ORDER BY guild_id, is_owner DESC, updated_at DESC
    `;
    cors(res, 'GET, OPTIONS');
    return sendJson(res, 200, {
      servers: (rows || []).map(function (row) {
        return {
          guild_id: row.guild_id,
          name: row.guild_name || row.guild_id,
          icon_url: row.icon_url || null,
          is_owner: !!row.is_owner,
          permissions: Array.isArray(row.permissions) ? row.permissions : (row.permissions || []),
        };
      })
    });
  } catch (e) {
    cors(res, 'GET, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

