/**
 * Stats backend config for GTA Bot website.
 * Prefer Neon (bot's database): set NEON_STATS_API_URL to your stats API base (e.g. http://localhost:8765).
 * Alternatively use Supabase: set __SUPABASE_URL__ and __SUPABASE_ANON_KEY__.
 *
 * Neon: run the bot's stats API from project root:
 *   python -m src.services.stats_api
 * Then set window.__NEON_STATS_API_URL__ = 'http://localhost:8765' (or your deployed URL).
 */
(function (global) {
  'use strict';
  global.GTA_STATS_CONFIG = {
    neonStatsApiUrl: global.__NEON_STATS_API_URL__ || '',
    supabaseUrl: global.__SUPABASE_URL__ || '',
    supabaseAnonKey: global.__SUPABASE_ANON_KEY__ || ''
  };
  global.GTA_STATS_SUPABASE = {
    url: global.GTA_STATS_CONFIG.supabaseUrl,
    anonKey: global.GTA_STATS_CONFIG.supabaseAnonKey
  };
})(typeof window !== 'undefined' ? window : this);
