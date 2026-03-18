const {
  cors,
  sendJson,
  requireUserId,
  parseBody,
  getSql,
  normalizeErrorStatus,
} = require('../../../../lib/site-api');

const DEFAULT_LOG_CATEGORIES = ['transactions', 'jobs', 'businesses', 'clubs', 'levelups', 'players', 'security', 'system', 'developer'];

function getGuildId(req) {
  if (req && req.query && req.query.guild_id) return String(req.query.guild_id);
  var url = String((req && req.url) || '');
  var match = url.match(/\/api\/admin\/server\/([^/]+)\/config/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function ensureManageable(sql, guildId, userId) {
  const rows = await sql`
    WITH explicit_access AS (
      SELECT guild_id, permissions, is_owner, updated_at
      FROM public.server_admins
      WHERE guild_id = ${guildId}
        AND user_id = ${userId}
    ),
    inferred_access AS (
      SELECT guild_id, '["administrator"]'::jsonb AS permissions, false AS is_owner, MAX(created_at) AS updated_at
      FROM public.bot_interactions
      WHERE guild_id = ${guildId}
        AND user_id = ${userId}
        AND command_name = 'setlevelingchannel'
      GROUP BY guild_id
      UNION
      SELECT guild_id, '["logging"]'::jsonb AS permissions, false AS is_owner, MAX(changed_at) AS updated_at
      FROM public.developer_log_audit
      WHERE guild_id = ${guildId}
        AND changed_by = ${userId}
      GROUP BY guild_id
    )
    SELECT guild_id, permissions, is_owner
    FROM (
      SELECT * FROM explicit_access
      UNION ALL
      SELECT * FROM inferred_access
    ) q
    ORDER BY is_owner DESC, updated_at DESC
    LIMIT 1
  `;
  return rows && rows[0] ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  const method = (req.method || req.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    cors(res, 'GET, POST, OPTIONS');
    res.statusCode = 204;
    return res.end();
  }
  if (method !== 'GET' && method !== 'POST') {
    cors(res, 'GET, POST, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const auth = requireUserId(req);
    const guildId = getGuildId(req);
    if (!guildId) {
      cors(res, 'GET, POST, OPTIONS');
      return sendJson(res, 400, { error: 'Missing guild_id' });
    }
    const sql = getSql();
    if (!sql) throw new Error('Server management requires DATABASE_URL / NEON_DATABASE_URL.');
    const access = await ensureManageable(sql, guildId, auth.userId);
    if (!access) {
      cors(res, 'GET, POST, OPTIONS');
      return sendJson(res, 403, { error: 'You are not allowed to manage that server.' });
    }

    if (method === 'GET') {
      const levelingRows = await sql`
        SELECT guild_id, leveling_channel_id, level_up_notifications_enabled, level_up_rewards_enabled, custom_level_titles, rp_multiplier
        FROM public.server_leveling_config
        WHERE guild_id = ${guildId}
        LIMIT 1
      `;
      const loggingRows = await sql`
        SELECT category_key, channel_id, enabled
        FROM public.developer_log_config
        WHERE guild_id = ${guildId}
        ORDER BY category_key ASC
      `;
      var categories = {};
      (loggingRows || []).forEach(function (row) {
        if (row.enabled) categories[row.category_key] = row.channel_id;
      });
      cors(res, 'GET, POST, OPTIONS');
      return sendJson(res, 200, {
        guild_id: guildId,
        leveling: levelingRows && levelingRows[0] ? levelingRows[0] : {},
        logging: { categories: categories, available_categories: DEFAULT_LOG_CATEGORIES }
      });
    }

    const body = parseBody(req);
    if (Object.prototype.hasOwnProperty.call(body, 'leveling_channel_id')) {
      const enabled = !!body.leveling_channel_id;
      await sql`
        INSERT INTO public.server_leveling_config (guild_id, leveling_channel_id, level_up_notifications_enabled, updated_at)
        VALUES (${guildId}, ${body.leveling_channel_id ? Number(body.leveling_channel_id) : null}, ${enabled}, NOW())
        ON CONFLICT (guild_id)
        DO UPDATE SET
          leveling_channel_id = EXCLUDED.leveling_channel_id,
          level_up_notifications_enabled = EXCLUDED.level_up_notifications_enabled,
          updated_at = NOW()
      `;
    }
    if (body.logging_channels && typeof body.logging_channels === 'object') {
      var keys = Object.keys(body.logging_channels);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var channelId = body.logging_channels[key];
        if (!channelId) {
          await sql`
            DELETE FROM public.developer_log_config
            WHERE guild_id = ${guildId}
              AND category_key = ${key}
          `;
        } else {
          await sql`
            INSERT INTO public.developer_log_config (guild_id, category_key, channel_id, enabled, updated_at)
            VALUES (${guildId}, ${key}, ${Number(channelId)}, true, NOW())
            ON CONFLICT (guild_id, category_key)
            DO UPDATE SET
              channel_id = EXCLUDED.channel_id,
              enabled = true,
              updated_at = NOW()
          `;
        }
      }
    }

    const levelingRows = await sql`
      SELECT guild_id, leveling_channel_id, level_up_notifications_enabled, level_up_rewards_enabled, custom_level_titles, rp_multiplier
      FROM public.server_leveling_config
      WHERE guild_id = ${guildId}
      LIMIT 1
    `;
    const loggingRows = await sql`
      SELECT category_key, channel_id, enabled
      FROM public.developer_log_config
      WHERE guild_id = ${guildId}
      ORDER BY category_key ASC
    `;
    var categories = {};
    (loggingRows || []).forEach(function (row) {
      if (row.enabled) categories[row.category_key] = row.channel_id;
    });
    cors(res, 'GET, POST, OPTIONS');
    return sendJson(res, 200, {
      guild_id: guildId,
      leveling: levelingRows && levelingRows[0] ? levelingRows[0] : {},
      logging: { categories: categories, available_categories: DEFAULT_LOG_CATEGORIES }
    });
  } catch (e) {
    cors(res, 'GET, POST, OPTIONS');
    return sendJson(res, normalizeErrorStatus(e && e.message), { error: (e && e.message) || 'Request failed' });
  }
};

