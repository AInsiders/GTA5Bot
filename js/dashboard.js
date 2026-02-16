/**
 * Dashboard: Connect Discord when logged out; user stats when logged in.
 * Fetches identity from /api/auth/me and game stats from /api/stats/user.
 * Displays user stats in the same style as the Global Stats page (cards, charts, animations).
 */
(function () {
  'use strict';

  var USER_KEY = 'gta_dashboard_user';
  var STATS_CACHE_MS = 5 * 60 * 1000; // 5 minutes – stats fetched once, reused until stale
  var dashboardDonutInstance = null;

  function getStoredUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setStoredUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    } catch (e) {}
  }

  function hasCachedStats(data) {
    return data && (data.cash !== undefined || (data.counts && typeof data.counts === 'object'));
  }

  function isStatsCacheFresh(data) {
    if (!data || !data.stats_fetched_at) return false;
    return (Date.now() - data.stats_fetched_at) < STATS_CACHE_MS;
  }

  /** Same base URL as auth and Global Stats - single source of truth so dashboard and API calls match. */
  function getStatsApiBase() {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    if (auth && auth.getApiBase) {
      var base = auth.getApiBase();
      if (base) return base;
    }
    var config = typeof window.GTA_STATS_CONFIG !== 'undefined' ? window.GTA_STATS_CONFIG : {};
    var url = (config.neonStatsApiUrl || window.__GTA_API_URL__ || window.__NEON_STATS_API_URL__) || '';
    return String(url).replace(/\/$/, '');
  }

  function fmt(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    var x = Number(n);
    if (x >= 1e12) return (x / 1e12).toFixed(2) + 'T';
    if (x >= 1e9) return (x / 1e9).toFixed(2) + 'B';
    if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M';
    if (x >= 1e3) return (x / 1e3).toFixed(2) + 'K';
    return String(Math.round(x));
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return '—'; }
  }

  function fmtRelative(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      var s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return 'Just now';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      if (s < 604800) return Math.floor(s / 86400) + 'd ago';
      return fmtDate(iso);
    } catch (e) { return '—'; }
  }

  function fmtDuration(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      var s = Math.floor((Date.now() - d.getTime()) / 1000);
      var days = Math.floor(s / 86400);
      var months = Math.floor(days / 30);
      var years = Math.floor(days / 365);
      if (years >= 1) return years + ' year' + (years > 1 ? 's' : '');
      if (months >= 1) return months + ' month' + (months > 1 ? 's' : '');
      if (days >= 1) return days + ' day' + (days > 1 ? 's' : '');
      if (s >= 3600) return Math.floor(s / 3600) + 'h';
      if (s >= 60) return Math.floor(s / 60) + 'm';
      return 'Just started';
    } catch (e) { return '—'; }
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value != null && value !== '' ? value : '—';
  }

  function animateStat(id, endValue, formatter, prefix) {
    var el = document.getElementById(id);
    if (!el) return;
    prefix = prefix || '';
    formatter = formatter || function (x) { return String(x); };
    var start = 0;
    var startStr = el.getAttribute('data-last-num');
    if (startStr !== null && startStr !== '') start = parseFloat(startStr, 10) || 0;
    el.setAttribute('data-last-num', String(endValue));
    var duration = 700;
    var startTime = null;
    function step(now) {
      if (!startTime) startTime = now;
      var t = Math.min((now - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - t, 2);
      var current = start + (endValue - start) * ease;
      el.textContent = prefix + formatter(current);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function drawUserDonutChart(data) {
    var canvas = document.getElementById('chart-dashboard-donut');
    if (!canvas || typeof window.Chart === 'undefined') return;
    if (dashboardDonutInstance) dashboardDonutInstance.destroy();
    var ctx = canvas.getContext('2d');
    var wallet = Number(data.cash) || 0;
    var bank = Number(data.bank_balance != null ? data.bank_balance : data.bank) || 0;
    var chips = Number(data.chips) || 0;
    var total = wallet + bank + chips;
    var labels = ['Wallet', 'Bank', 'Chips'];
    var values = [wallet, bank, chips];
    var colors = ['rgba(0, 255, 136, 0.8)', 'rgba(0, 230, 118, 0.7)', 'rgba(255, 215, 0, 0.8)'];
    var borders = ['#00ff88', '#00e676', '#ffd700'];
    if (total <= 0) {
      values = [1];
      labels = ['No data yet'];
      colors = ['rgba(122, 138, 122, 0.5)'];
      borders = ['#7a8a7a'];
    }
    dashboardDonutInstance = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 900 },
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#7a8a7a', padding: 12 } },
          tooltip: {
            callbacks: {
              label: function (item) {
                var v = item.raw;
                var pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
                return item.label + ': $' + fmt(v) + (total > 0 ? ' (' + pct + '%)' : '');
              }
            },
            backgroundColor: 'rgba(10, 14, 10, 0.95)',
            titleColor: '#00ff88',
            bodyColor: '#e8f0e8',
            borderColor: 'rgba(0, 255, 136, 0.4)',
            borderWidth: 1
          }
        }
      }
    });
  }

  function setDashboardConnectionStatus(status, text) {
    var el = document.getElementById('dashboard-stats-connection');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'stats-connection' + (status ? ' stats-connection--' + status : '');
  }

  function showDashboardStatsError(show, message) {
    var el = document.getElementById('dashboard-stats-error');
    var textEl = document.getElementById('dashboard-stats-error-text');
    if (el) el.style.display = show ? 'block' : 'none';
    if (textEl && message) textEl.textContent = message;
  }

  function showGuestView() {
    var guest = document.getElementById('dashboard-guest');
    var user = document.getElementById('dashboard-user');
    if (guest) guest.style.display = 'block';
    if (user) user.style.display = 'none';
    showDashboardStatsError(false);
    setDashboardConnectionStatus('', '');
  }

  function showUserView(userData) {
    var guest = document.getElementById('dashboard-guest');
    var user = document.getElementById('dashboard-user');
    if (guest) guest.style.display = 'none';
    if (user) user.style.display = 'block';
    if (userData && (userData.cash !== undefined || (userData.counts && typeof userData.counts === 'object'))) {
      showDashboardStatsError(false);
    }
    if (!userData) return;

    var username = document.getElementById('dashboard-username');
    var userId = document.getElementById('dashboard-user-id');
    var avatar = document.getElementById('dashboard-avatar');
    if (username) username.textContent = userData.username || userData.global_name || 'Player';
    if (userId) userId.textContent = userData.id ? 'ID: ' + userData.id : '';
    if (avatar && userData.avatar) {
      var url = 'https://cdn.discordapp.com/avatars/' + userData.id + '/' + userData.avatar + '.png';
      avatar.style.backgroundImage = 'url(' + url + ')';
      avatar.textContent = '';
    } else if (avatar) {
      avatar.style.backgroundImage = '';
      avatar.textContent = '👤';
    }

    /* Populate top stat cards (like Global Stats page) with animated values */
    setDashboardConnectionStatus('live', 'Connected');
    var cashVal = userData.cash != null ? Number(userData.cash) : 0;
    var bankVal = (userData.bank != null || userData.bank_balance != null) ? Number(userData.bank_balance != null ? userData.bank_balance : userData.bank) : 0;
    var chipsVal = userData.chips != null ? Number(userData.chips) : 0;
    var netVal = userData.net_worth != null ? Number(userData.net_worth) : (cashVal + bankVal + chipsVal);
    var levelVal = userData.level != null ? Number(userData.level) : 1;
    var repVal = userData.rep != null ? Number(userData.rep) : 0;
    animateStat('dash-stat-wallet', cashVal, fmt, '$');
    animateStat('dash-stat-bank', bankVal, fmt, '$');
    animateStat('dash-stat-chips', chipsVal, fmt, '');
    animateStat('dash-stat-networth', netVal, fmt, '$');
    animateStat('dash-stat-level', levelVal, function (x) { return String(Math.round(x)); }, '');
    animateStat('dash-stat-rep', repVal, fmt, '');
    drawUserDonutChart(userData);

    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val != null && val !== '' ? val : '—'; };
    var counts = userData.counts || {};

    set('dash-cash', userData.cash != null ? '$' + fmt(userData.cash) : null);
    set('dash-bank', (userData.bank != null || userData.bank_balance != null) ? '$' + fmt(userData.bank != null ? userData.bank : userData.bank_balance) : null);
    set('dash-chips', userData.chips != null ? fmt(userData.chips) : null);
    set('dash-networth', userData.net_worth != null ? '$' + fmt(userData.net_worth) : null);
    set('dash-total-earned', userData.total_cash_earned != null ? '$' + fmt(userData.total_cash_earned) : null);
    set('dash-level', userData.level);
    set('dash-rank', userData.rank || userData.level_title);
    set('dash-rep', userData.rep != null ? fmt(userData.rep) : null);
    set('dash-wanted', userData.wanted_level);

    var vWh = counts.vehicle_warehouse || 0;
    var cWh = counts.cargo_warehouse || 0;
    set('dash-vehicles', counts.vehicles);
    set('dash-properties', counts.properties);
    set('dash-businesses', counts.businesses);
    set('dash-warehouses-combined', vWh + cWh);

    var act = userData.activity_stats || {};
    set('dash-jobs-total', act.jobs_total);
    set('dash-heists-total', act.heists_total);
    set('dash-casino-total', act.casino_total);
    set('dash-trivia-correct', act.trivia_correct);

    set('dash-created-at', fmtDate(userData.created_at || userData.playing_since));
    set('dash-last-activity', fmtRelative(userData.last_activity));
    set('dash-daily-streak', userData.daily_streak);

    var playingSinceEl = document.getElementById('dash-playing-since');
    if (playingSinceEl) playingSinceEl.textContent = userData.created_at ? 'Playing for ' + fmtDuration(userData.created_at) : '';

    renderActivityBreakdown(act);
  }

  function renderActivityBreakdown(act) {
    var wrap = document.getElementById('dashboard-activity-breakdown');
    var loading = document.getElementById('dashboard-activity-loading');
    if (!wrap) return;
    if (loading) loading.remove();

    var html = '';
    function chip(name, val) {
      if (val == null || val === '' || (typeof val === 'number' && val === 0)) return '';
      return '<span class="dashboard-activity-chip"><span class="dashboard-activity-chip-name">' + escapeHtml(String(name)) + '</span><span class="dashboard-activity-chip-value">' + escapeHtml(String(val)) + '</span></span>';
    }
    function escapeHtml(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    var jobs = act.jobs || {};
    if (jobs && typeof jobs === 'object' && Object.keys(jobs).length > 0) {
      html += '<div class="dashboard-activity-group"><div class="dashboard-activity-group-title">Jobs by type</div><div class="dashboard-activity-items">';
      for (var k in jobs) { html += chip(k, jobs[k]); }
      html += '</div></div>';
    }

    var heists = act.heists || {};
    if (heists && typeof heists === 'object' && Object.keys(heists).length > 0) {
      html += '<div class="dashboard-activity-group"><div class="dashboard-activity-group-title">Heists by type</div><div class="dashboard-activity-items">';
      for (var k in heists) { html += chip(k, heists[k]); }
      html += '</div></div>';
    }

    var casino = act.casino || {};
    if (casino && typeof casino === 'object' && Object.keys(casino).length > 0) {
      html += '<div class="dashboard-activity-group"><div class="dashboard-activity-group-title">Casino by game</div><div class="dashboard-activity-items">';
      for (var k in casino) { html += chip(k, casino[k]); }
      html += '</div></div>';
    }

    var rows = [];
    if ((act.banking_deposits || 0) + (act.banking_withdrawals || 0) > 0) {
      rows.push(chip('Deposits', act.banking_deposits) + chip('Withdrawals', act.banking_withdrawals));
    }
    if ((act.car_theft_total || 0) > 0) {
      rows.push(chip('Car thefts', act.car_theft_success + '/' + act.car_theft_total) + chip('Earned', act.car_theft_earnings ? '$' + fmt(act.car_theft_earnings) : ''));
    }
    if ((act.stealing_total || 0) > 0) {
      rows.push(chip('Steals', act.stealing_success + '/' + act.stealing_total) + chip('Stolen', act.stealing_earnings ? '$' + fmt(act.stealing_earnings) : ''));
    }
    if ((act.business_sales || 0) > 0) rows.push(chip('Business sales', act.business_sales));
    if ((act.shop_purchases || 0) > 0) rows.push(chip('Shop purchases', act.shop_purchases));

    if (rows.length > 0) {
      html += '<div class="dashboard-activity-group"><div class="dashboard-activity-group-title">Other activity</div><div class="dashboard-activity-items">' + rows.join('') + '</div></div>';
    }

    if (!html) html = '<p class="dashboard-loading">No activity recorded yet. Play in Discord to build your stats.</p>';
    wrap.innerHTML = html;
  }

  function fetchUserStats() {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var base = getStatsApiBase();
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!base) return Promise.reject(new Error('Missing API URL. Set __GTA_API_URL__ in config.js.'));
    if (!token) return Promise.reject(new Error('Not logged in'));

    return fetch(base + '/api/stats/user', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) {
        var msg = r.status === 401 ? 'Session expired. Please log in again.' : 'Stats fetch failed (' + r.status + ')';
        return r.json().catch(function () { return {}; }).then(function (d) {
          throw new Error((d && d.error) || msg);
        });
      }
      return r.json();
    });
  }

  function refreshDashboardStats() {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!token || !auth) return Promise.reject(new Error('Not logged in'));
    if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] Fetching /api/auth/me and /api/stats/user…');
    setDashboardConnectionStatus('checking', 'Loading stats…');
    return auth.fetchMe().then(function (me) {
      if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/auth/me OK', me && me.id ? 'user ' + me.id : 'no id');
      if (!me || !me.id) return showGuestView();
      setStoredUser(me);
      return fetchUserStats().then(function (stats) {
        if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/stats/user OK', stats && (stats.cash !== undefined) ? 'has stats' : 'no stats');
        showDashboardStatsError(false);
        var merged = Object.assign({}, me, stats);
        merged.stats_fetched_at = Date.now();
        setStoredUser(merged);
        showUserView(merged);
      }).catch(function (err) {
        if (window.__GTA_DEBUG__) console.warn('[GTA Dashboard] /api/stats/user failed', err && err.message);
        setDashboardConnectionStatus('error', 'Stats unavailable');
        showUserView(me);
        showDashboardStatsError(true, (err && err.message) || 'Couldn\'t load your stats.');
      });
    }).catch(function (err) {
      if (window.__GTA_DEBUG__) console.warn('[GTA Dashboard] /api/auth/me failed', err && err.message);
      showGuestView();
    });
  }

  function onDashboardPageActive() {
    var page = document.getElementById('page-dashboard');
    if (!page || !page.classList.contains('is-active')) return;

    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var token = auth && auth.getToken ? auth.getToken() : '';

    if (!token) {
      showGuestView();
      return;
    }

    var cached = getStoredUser();
    if (cached) showUserView(cached);

    /* Always refresh when dashboard becomes active so stats stay current; use cache only as initial placeholder. */
    refreshDashboardStats();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var statsPage = document.getElementById('page-dashboard');
    if (!statsPage) return;

    /* When user logs in (e.g. OAuth callback consumes session), refresh dashboard if visible. */
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    if (auth && auth.onAuthStateChange) {
      auth.onAuthStateChange(function (loggedIn) {
        if (loggedIn && statsPage.classList.contains('is-active')) {
          refreshDashboardStats();
        }
      });
    }

    var logoutBtn = document.getElementById('dashboard-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
        if (auth && auth.clearToken) auth.clearToken();
        try { localStorage.removeItem(USER_KEY); } catch (e) {}
        showGuestView();
      });
    }
    function wireRefreshButtons() {
      var refreshBtn = document.getElementById('dashboard-refresh');
      var refreshFromError = document.getElementById('dashboard-refresh-from-error');
      function doRefresh() {
        if (refreshBtn) refreshBtn.disabled = true;
        if (refreshFromError) refreshFromError.disabled = true;
        refreshDashboardStats().finally(function () {
          if (refreshBtn) refreshBtn.disabled = false;
          if (refreshFromError) refreshFromError.disabled = false;
        });
      }
      if (refreshBtn) refreshBtn.addEventListener('click', doRefresh);
      if (refreshFromError) refreshFromError.addEventListener('click', doRefresh);
    }
    wireRefreshButtons();

    var debounceTimer = null;
    var lastActive = false;
    function scheduleCheck() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        var isActive = statsPage.classList.contains('is-active');
        if (isActive && !lastActive) onDashboardPageActive();
        lastActive = isActive;
      }, 80);
    }

    var observer = new MutationObserver(scheduleCheck);
    observer.observe(document.querySelector('.app-pages') || document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });

    if (statsPage.classList.contains('is-active')) {
      lastActive = true;
      onDashboardPageActive();
    }
  });
})();
