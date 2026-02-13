/**
 * Dashboard: Connect Discord when logged out; user stats when logged in.
 * Fetches identity from /api/auth/me and game stats from /api/stats/user.
 */
(function () {
  'use strict';

  var USER_KEY = 'gta_dashboard_user';

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

  function getApiBase() {
    var raw = (typeof window !== 'undefined' && window.__GTA_API_URL__) ? String(window.__GTA_API_URL__) : '';
    return raw.replace(/\/$/, '');
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

  function showGuestView() {
    var guest = document.getElementById('dashboard-guest');
    var user = document.getElementById('dashboard-user');
    if (guest) guest.style.display = 'block';
    if (user) user.style.display = 'none';
  }

  function showUserView(userData) {
    var guest = document.getElementById('dashboard-guest');
    var user = document.getElementById('dashboard-user');
    if (guest) guest.style.display = 'none';
    if (user) user.style.display = 'block';

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
    var base = getApiBase();
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!base || !token) return Promise.reject(new Error('Missing API or token'));

    return fetch(base + '/api/stats/user', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (r) {
      if (r.status === 401 && auth && auth.clearToken) auth.clearToken();
      return r.ok ? r.json() : Promise.reject(new Error('Stats fetch failed'));
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

    auth.fetchMe()
      .then(function (me) {
        if (!me || !me.id) return showGuestView();
        setStoredUser(me);
        return fetchUserStats().then(function (stats) {
          var merged = Object.assign({}, me, stats);
          setStoredUser(merged);
          showUserView(merged);
        }).catch(function () {
          showUserView(me);
        });
      })
      .catch(function () {
        showGuestView();
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var statsPage = document.getElementById('page-dashboard');
    if (!statsPage) return;

    var logoutBtn = document.getElementById('dashboard-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
        if (auth && auth.clearToken) auth.clearToken();
        try { localStorage.removeItem(USER_KEY); } catch (e) {}
        showGuestView();
      });
    }

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
