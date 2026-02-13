(function () {
  'use strict';

  var config = typeof window.GTA_STATS_CONFIG !== 'undefined' ? window.GTA_STATS_CONFIG : {};
  var chartInstance = null;
  var chartDonutInstance = null;
  var statsRefreshInterval = null;
  var REFRESH_MS = 30000; // 30 seconds

  function getNeonApiBase() {
    return (config.neonStatsApiUrl || '').replace(/\/$/, '');
  }

  function hasConfig() {
    return getNeonApiBase().length > 0;
  }

  function escapeHtml(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function formatCash(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    var x = Number(n);
    if (x >= 1e12) return (x / 1e12).toFixed(2) + 'T';
    if (x >= 1e9) return (x / 1e9).toFixed(2) + 'B';
    if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M';
    if (x >= 1e3) return (x / 1e3).toFixed(2) + 'K';
    return String(Math.round(x));
  }

  function showConnectMsg(show) {
    var el = document.getElementById('stats-connect-msg');
    var global = document.getElementById('stats-global');
    if (el) el.style.display = show ? 'block' : 'none';
    if (global) global.style.display = show ? 'none' : 'block';
  }

  function setConnectionStatus(status, text) {
    var el = document.getElementById('stats-connection');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'stats-connection' + (status ? ' stats-connection--' + status : '');
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
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

  function fetchGlobalStats(silent) {
    if (!hasConfig()) {
      setConnectionStatus('', '');
      showConnectMsg(true);
      return;
    }
    showConnectMsg(false);
    if (!silent) setConnectionStatus('checking', 'Checking connection…');
    var base = getNeonApiBase();
    fetch(base + '/api/stats/global')
      .then(function (r) {
        if (!r.ok) return Promise.reject(new Error(r.statusText || 'Connection failed'));
        return r.json();
      })
      .then(function (d) {
        setConnectionStatus('live', 'Connected to Neon');
        var numUsers = Number(d.total_users) || 0;
        var numCash = Number(d.total_cash_in_economy) || 0;
        var numEarned = Number(d.total_earned_all_users) || 0;
        var numChips = Number(d.total_chips) || 0;
        var level = d.highest_level != null ? Number(d.highest_level) : 0;
        var active = Number(d.active_users_24h) || 0;
        animateStat('stat-total-users', numUsers, formatCash, '');
        animateStat('stat-total-cash', numCash, formatCash, '$');
        animateStat('stat-total-earned', numEarned, formatCash, '$');
        animateStat('stat-total-chips', numChips, formatCash, '');
        if (level === 0) setStat('stat-highest-level', '—'); else animateStat('stat-highest-level', level, function (x) { return String(Math.round(x)); }, '');
        animateStat('stat-active-24h', active, formatCash, '');
        drawChart(d);
        drawDonutChart(d);
      })
      .catch(function (err) {
        setConnectionStatus('error', 'Connection failed. Start the stats API or check config.');
        showConnectMsg(true);
      });
  }

  function drawChart(data) {
    var canvas = document.getElementById('chart-stats');
    if (!canvas || typeof window.Chart === 'undefined') return;
    var ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    var totalCash = Number(data.total_cash_in_economy) || 0;
    var totalEarned = Number(data.total_earned_all_users) || 0;
    var totalChips = Number(data.total_chips) || 0;
    var totalUsers = Number(data.total_users) || 0;
    var active24h = Number(data.active_users_24h) || 0;

    var grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(0, 255, 136, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 230, 118, 0.7)');
    grad.addColorStop(1, 'rgba(0, 200, 100, 0.5)');

    chartInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Economy $', 'Earned $', 'Chips', 'Players', 'Active 24h'],
        datasets: [{
          label: 'Value',
          data: [
            Math.min(totalCash, 1e12) / 1e9,
            Math.min(totalEarned, 1e12) / 1e9,
            Math.min(totalChips, 1e9) / 1e6,
            totalUsers,
            active24h
          ],
          backgroundColor: grad,
          borderColor: '#00ff88',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 800 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10, 14, 10, 0.95)',
            titleColor: '#00ff88',
            bodyColor: '#e8f0e8',
            borderColor: 'rgba(0, 255, 136, 0.4)',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0, 255, 136, 0.12)' },
            ticks: { color: '#7a8a7a' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#7a8a7a', maxRotation: 25 }
          }
        }
      }
    });
  }

  function drawDonutChart(data) {
    var canvas = document.getElementById('chart-donut');
    if (!canvas || typeof window.Chart === 'undefined') return;
    var ctx = canvas.getContext('2d');
    if (chartDonutInstance) chartDonutInstance.destroy();

    var wallet = Number(data.total_wallet_money) || 0;
    var bank = Number(data.total_bank_money) || 0;
    var chips = Number(data.total_chips) || 0;
    var total = wallet + bank + chips;
    var labels = ['Wallet', 'Bank', 'Chips'];
    var values = [wallet, bank, chips];
    var colors = ['rgba(0, 255, 136, 0.8)', 'rgba(0, 230, 118, 0.7)', 'rgba(255, 215, 0, 0.8)'];
    var borders = ['#00ff88', '#00e676', '#ffd700'];
    if (total <= 0) {
      values = [1];
      labels = ['No data'];
      colors = ['rgba(122, 138, 122, 0.5)'];
      borders = ['#7a8a7a'];
    }

    chartDonutInstance = new window.Chart(ctx, {
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
          legend: {
            position: 'bottom',
            labels: { color: '#7a8a7a', padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: function (item) {
                var v = item.raw;
                var pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
                return item.label + ': ' + formatCash(v) + ' (' + pct + '%)';
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

  function renderLeaderboard(rows, valueLabel) {
    var tbody = document.getElementById('leaderboard-tbody');
    var wrap = document.getElementById('leaderboard-table-wrap');
    var loading = document.getElementById('leaderboard-loading');
    var errEl = document.getElementById('leaderboard-error');
    if (!tbody) return;
    if (loading) loading.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    if (!rows || rows.length === 0) {
      if (wrap) wrap.style.display = 'none';
      if (errEl) { errEl.textContent = 'No data.'; errEl.style.display = 'block'; }
      return;
    }
    wrap.style.display = 'block';
    tbody.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      var val = r.value != null ? (valueLabel === 'cash' ? '$' + formatCash(r.value) : formatCash(r.value)) : '—';
      var displayName = r.display || r.username || (r.user_id || '').slice(0, 20);
      tr.innerHTML = '<td>' + (r.rank || '—') + '</td><td><span class="leaderboard-name">' + escapeHtml(displayName) + '</span></td><td>' + val + '</td>';
      tbody.appendChild(tr);
    });
  }

  function fetchLeaderboard(type, silent) {
    var loading = document.getElementById('leaderboard-loading');
    var wrap = document.getElementById('leaderboard-table-wrap');
    var errEl = document.getElementById('leaderboard-error');
    if (!silent) {
      if (loading) loading.style.display = 'block';
      if (wrap) wrap.style.display = 'none';
      if (errEl) errEl.style.display = 'none';
    }

    if (!hasConfig()) {
      if (loading) loading.style.display = 'none';
      if (errEl) { errEl.textContent = 'Set Neon Stats API URL to load leaderboards.'; errEl.style.display = 'block'; }
      return;
    }
    var base = getNeonApiBase();
    fetch(base + '/api/stats/leaderboard?type=' + encodeURIComponent(type) + '&limit=100')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.statusText)); })
      .then(function (data) {
        var valueLabel = (type === 'net_worth' || type === 'wealth' || type === 'cash' || type === 'bank') ? 'cash' : 'number';
        renderLeaderboard(Array.isArray(data) ? data : [], valueLabel);
      })
      .catch(function (e) {
        if (loading) loading.style.display = 'none';
        if (errEl) { errEl.textContent = e.message || 'Request failed.'; errEl.style.display = 'block'; }
      });
  }

  function onStatsPageActive() {
    var page = document.getElementById('page-stats');
    if (!page || !page.classList.contains('is-active')) return;
    fetchGlobalStats();
    var currentTab = document.querySelector('.leaderboard-tab.active');
    fetchLeaderboard(currentTab ? currentTab.getAttribute('data-board') : 'net_worth');
    if (statsRefreshInterval) clearInterval(statsRefreshInterval);
    statsRefreshInterval = setInterval(function () {
      if (!page.classList.contains('is-active')) return;
      fetchGlobalStats(true);
      var tab = document.querySelector('.leaderboard-tab.active');
      fetchLeaderboard(tab ? tab.getAttribute('data-board') : 'net_worth', true);
    }, REFRESH_MS);
  }

  function onStatsPageInactive() {
    if (statsRefreshInterval) {
      clearInterval(statsRefreshInterval);
      statsRefreshInterval = null;
    }
  }

  document.querySelectorAll('.leaderboard-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.leaderboard-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      fetchLeaderboard(tab.getAttribute('data-board'));
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var statsPage = document.getElementById('page-stats');
    if (!statsPage) return;
    var debounceTimer = null;
    var lastActive = false;
    function scheduleCheck() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        var isActive = statsPage.classList.contains('is-active');
        if (isActive && !lastActive) onStatsPageActive();
        if (!isActive && lastActive) onStatsPageInactive();
        lastActive = isActive;
      }, 80);
    }
    var observer = new MutationObserver(function () {
      scheduleCheck();
    });
    observer.observe(document.querySelector('.app-pages') || document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    if (statsPage.classList.contains('is-active')) {
      lastActive = true;
      onStatsPageActive();
    }
  });
})();
