(function () {
  'use strict';

  var config = typeof window.GTA_STATS_CONFIG !== 'undefined' ? window.GTA_STATS_CONFIG : {};
  var supabaseConfig = typeof window.GTA_STATS_SUPABASE !== 'undefined' ? window.GTA_STATS_SUPABASE : {};
  var supabase = null;
  var chartInstance = null;

  function useNeonApi() {
    var base = (config.neonStatsApiUrl || '').replace(/\/$/, '');
    return base.length > 0;
  }

  function getNeonApiBase() {
    return (config.neonStatsApiUrl || '').replace(/\/$/, '');
  }

  function hasConfig() {
    return useNeonApi() || !!(supabaseConfig.url && supabaseConfig.anonKey);
  }

  function initClient() {
    if (useNeonApi()) return { _neon: true };
    if (!(supabaseConfig.url && supabaseConfig.anonKey) || typeof window.supabase === 'undefined') return null;
    if (supabase) return supabase;
    supabase = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
    return supabase;
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

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function fetchGlobalStats() {
    if (!hasConfig()) {
      showConnectMsg(true);
      return;
    }
    showConnectMsg(false);
    if (useNeonApi()) {
      var base = getNeonApiBase();
      fetch(base + '/api/stats/global')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.statusText)); })
        .then(function (d) {
          setStat('stat-total-users', formatCash(d.total_users));
          setStat('stat-total-cash', '$' + formatCash(d.total_cash_in_economy));
          setStat('stat-total-earned', '$' + formatCash(d.total_earned_all_users));
          setStat('stat-total-chips', formatCash(d.total_chips));
          setStat('stat-highest-level', d.highest_level != null ? d.highest_level : '—');
          setStat('stat-active-24h', formatCash(d.active_users_24h));
          drawChart(d);
        })
        .catch(function () { showConnectMsg(true); });
      return;
    }
    var client = initClient();
    if (!client) {
      showConnectMsg(true);
      return;
    }
    client.rpc('get_server_stats')
      .then(function (res) {
        if (res.error) {
          showConnectMsg(true);
          return;
        }
        var d = res.data || {};
        setStat('stat-total-users', formatCash(d.total_users));
        setStat('stat-total-cash', '$' + formatCash(d.total_cash_in_economy));
        setStat('stat-total-earned', '$' + formatCash(d.total_earned_all_users));
        setStat('stat-total-chips', formatCash(d.total_chips));
        setStat('stat-highest-level', d.highest_level != null ? d.highest_level : '—');
        setStat('stat-active-24h', formatCash(d.active_users_24h));
        drawChart(d);
      })
      .catch(function () {
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

    chartInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Total economy $', 'Total earned $', 'Total chips', 'Total players', 'Active (24h)'],
        datasets: [{
          label: 'Value',
          data: [
            Math.min(totalCash, 1e12) / 1e9,
            Math.min(totalEarned, 1e12) / 1e9,
            Math.min(totalChips, 1e9) / 1e6,
            totalUsers,
            active24h
          ],
          backgroundColor: [
            'rgba(0, 255, 136, 0.6)',
            'rgba(0, 230, 118, 0.6)',
            'rgba(255, 215, 0, 0.6)',
            'rgba(0, 255, 136, 0.4)',
            'rgba(255, 179, 0, 0.6)'
          ],
          borderColor: ['#00ff88', '#00e676', '#ffd700', '#00cc6a', '#ffb300'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0, 255, 136, 0.1)' },
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
      tr.innerHTML = '<td>' + (r.rank || '—') + '</td><td><code>' + (r.user_id || '').slice(0, 20) + '</code></td><td>' + val + '</td>';
      tbody.appendChild(tr);
    });
  }

  function fetchLeaderboard(type) {
    var loading = document.getElementById('leaderboard-loading');
    var wrap = document.getElementById('leaderboard-table-wrap');
    var errEl = document.getElementById('leaderboard-error');
    if (loading) loading.style.display = 'block';
    if (wrap) wrap.style.display = 'none';
    if (errEl) errEl.style.display = 'none';

    if (!hasConfig()) {
      if (loading) loading.style.display = 'none';
      if (errEl) { errEl.textContent = 'Configure Neon Stats API or Supabase to load leaderboards.'; errEl.style.display = 'block'; }
      return;
    }
    if (useNeonApi()) {
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
      return;
    }
    var client = initClient();
    if (!client) {
      if (loading) loading.style.display = 'none';
      if (errEl) { errEl.textContent = 'Supabase not available.'; errEl.style.display = 'block'; }
      return;
    }
    client.rpc('get_leaderboard_top', { leaderboard_type: type, limit_count: 100 })
      .then(function (res) {
        if (res.error) {
          if (loading) loading.style.display = 'none';
          if (errEl) { errEl.textContent = res.error.message || 'Failed to load.'; errEl.style.display = 'block'; }
          return;
        }
        var valueLabel = (type === 'net_worth' || type === 'wealth' || type === 'cash' || type === 'bank') ? 'cash' : 'number';
        renderLeaderboard(res.data || [], valueLabel);
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
  }

  document.querySelectorAll('.leaderboard-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.leaderboard-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      fetchLeaderboard(tab.getAttribute('data-board'));
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('page-stats')) {
      var observer = new MutationObserver(function () {
        onStatsPageActive();
      });
      observer.observe(document.querySelector('.app-pages') || document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
      if (document.getElementById('page-stats').classList.contains('is-active')) {
        onStatsPageActive();
      }
    }
  });
})();
