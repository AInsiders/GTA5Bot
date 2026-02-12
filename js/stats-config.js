/**
 * Neon stats API config for GTA Bot website.
 * Set window.__NEON_STATS_API_URL__ (e.g. in js/config.js) to your stats API base URL.
 * Run the stats API from project root: python -m src.services.stats_api
 * On localhost the site auto-uses http://127.0.0.1:8765 if not set.
 */
(function (global) {
  'use strict';
  global.GTA_STATS_CONFIG = {
    neonStatsApiUrl: global.__NEON_STATS_API_URL__ || ''
  };
})(typeof window !== 'undefined' ? window : this);
