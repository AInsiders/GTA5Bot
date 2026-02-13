/**
 * Dashboard: Connect Discord, user stats (coming soon).
 * When authenticated, fetches and displays user stats. For now shows connect prompt.
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
    if (username) username.textContent = userData.username || 'Player';
    if (userId) userId.textContent = userData.id ? 'ID: ' + userData.id : '';
    if (avatar && userData.avatar) {
      var url = 'https://cdn.discordapp.com/avatars/' + userData.id + '/' + userData.avatar + '.png';
      avatar.style.backgroundImage = 'url(' + url + ')';
      avatar.textContent = '';
    }

    var dashCash = document.getElementById('dash-cash');
    var dashBank = document.getElementById('dash-bank');
    var dashChips = document.getElementById('dash-chips');
    var dashLevel = document.getElementById('dash-level');
    var dashRep = document.getElementById('dash-rep');
    var fmt = function (n) {
      if (n == null || n === '' || isNaN(Number(n))) return '—';
      var x = Number(n);
      if (x >= 1e9) return (x / 1e9).toFixed(2) + 'B';
      if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M';
      if (x >= 1e3) return (x / 1e3).toFixed(2) + 'K';
      return String(Math.round(x));
    };
    if (dashCash) dashCash.textContent = userData.cash != null ? '$' + fmt(userData.cash) : '—';
    if (dashBank) dashBank.textContent = userData.bank != null ? '$' + fmt(userData.bank) : '—';
    if (dashChips) dashChips.textContent = userData.chips != null ? fmt(userData.chips) : '—';
    if (dashLevel) dashLevel.textContent = userData.level != null ? String(userData.level) : '—';
    if (dashRep) dashRep.textContent = userData.rep != null ? fmt(userData.rep) : '—';
  }

  function onDashboardPageActive() {
    var page = document.getElementById('page-dashboard');
    if (!page || !page.classList.contains('is-active')) return;

    // Optimistic render from cached user, then refresh via /api/auth/me if token exists.
    var cached = getStoredUser();
    if (cached) showUserView(cached);
    else showGuestView();

    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    if (!auth || !auth.getToken || !auth.fetchMe) return;

    var token = auth.getToken();
    if (!token) return;

    auth.fetchMe()
      .then(function (me) {
        if (!me || !me.id) return;
        setStoredUser(me);
        showUserView(me);
      })
      .catch(function () {
        showGuestView();
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var statsPage = document.getElementById('page-dashboard');
    if (!statsPage) return;

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
