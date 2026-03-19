/**
 * Dashboard: Connect Discord when logged out; user stats when logged in.
 * Fetches identity from /api/auth/me and game stats from /api/stats/user.
 */
(function () {
  'use strict';

  var USER_KEY = 'gta_dashboard_user';
  var STATS_CACHE_MS = 5 * 60 * 1000; // 5 minutes – stats fetched once, reused until stale

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

  function fmtClubRank(rankKey) {
    if (!rankKey) return '—';
    return String(rankKey)
      .split('_')
      .map(function (part) { return part ? part.charAt(0).toUpperCase() + part.slice(1) : ''; })
      .join(' ');
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showDashboardStatsError(show, message) {
    var el = document.getElementById('dashboard-stats-error');
    var textEl = document.getElementById('dashboard-stats-error-text');
    if (el) el.style.display = show ? 'block' : 'none';
    if (textEl && message) textEl.textContent = message;
  }

  function showNoGameDataHint(show, message) {
    var el = document.getElementById('dashboard-no-game-data-hint');
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
    if (show && typeof message === 'string') el.textContent = message;
  }

  function showGuestView() {
    var guest = document.getElementById('dashboard-guest');
    var user = document.getElementById('dashboard-user');
    if (guest) guest.style.display = 'block';
    if (user) user.style.display = 'none';
    showDashboardStatsError(false);
    showNoGameDataHint(false);
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

    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val != null && val !== '' ? val : '—'; };
    var counts = userData.counts || {};

    // Top stat cards (same style as Global Stats)
    set('dash-stat-cash', userData.cash != null ? '$' + fmt(userData.cash) : null);
    set('dash-stat-bank', (userData.bank != null || userData.bank_balance != null) ? '$' + fmt(userData.bank != null ? userData.bank : userData.bank_balance) : null);
    set('dash-stat-chips', userData.chips != null ? fmt(userData.chips) : null);
    set('dash-stat-networth', userData.net_worth != null ? '$' + fmt(userData.net_worth) : null);
    set('dash-stat-level', userData.level);
    set('dash-stat-rank', userData.rank || userData.level_title);
    set('dash-stat-rp', userData.total_rp != null ? fmt(userData.total_rp) + ' RP' : null);

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
    set('dash-mc-businesses', counts.mc_businesses);
    set('dash-warehouses-combined', vWh + cWh);

    renderClubHome(userData.club_home);

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

  function renderClubHome(clubHome) {
    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val != null && val !== '' ? val : '—';
    };

    if (!clubHome || !clubHome.club_id) {
      set('dash-club-name', 'Not in an MC club');
      set('dash-club-rank', null);
      set('dash-club-level', null);
      set('dash-club-members', null);
      set('dash-club-treasury', null);
      set('dash-club-applications', null);
      return;
    }

    var clubName = clubHome.club_name || 'Unnamed Club';
    if (clubHome.club_tag) clubName += ' [' + clubHome.club_tag + ']';

    set('dash-club-name', clubName);
    set('dash-club-rank', fmtClubRank(clubHome.rank_key));
    set('dash-club-level', clubHome.level);
    set('dash-club-members', clubHome.member_count);
    set('dash-club-treasury', clubHome.treasury_cash != null ? '$' + fmt(clubHome.treasury_cash) : null);
    set('dash-club-applications', clubHome.pending_applications);
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

  var garageState = null;
  var garageSaveTimer = null;
  var clubState = null;
  var serverState = null;
  var CLUB_OFFICERS = ['president', 'vice_president', 'road_captain', 'treasurer', 'recruiter', 'enforcer'];
  var CLUB_INVITE_RANKS = ['president', 'vice_president', 'road_captain', 'recruiter'];
  var CLUB_RANK_MANAGERS = ['president', 'vice_president'];
  var CLUB_RANKS = ['vice_president', 'road_captain', 'treasurer', 'recruiter', 'enforcer', 'veteran', 'member', 'prospect'];

  function renderGaragePanel(state) {
    var container = document.getElementById('dashboard-garage-panel');
    var loading = document.getElementById('dashboard-garage-loading');
    if (!container) return;
    if (loading) loading.style.display = 'none';

    if (!state || !state.garages || !state.garages.length) {
      container.innerHTML = '<p class="dashboard-empty">No garage slots yet. Buy a garage property in Discord to store vehicles.</p>';
      return;
    }

    var g = state.garages[0];
    var slots = Array.isArray(g.slots) ? g.slots : [];
    var used = (state.meta && state.meta.used_slots) || slots.filter(function (s) { return s && s.vehicle; }).length;
    var total = (state.meta && state.meta.total_slots) || slots.length;

    var html = '';
    html += '<div class="dashboard-garage-summary dashboard-stat-row">';
    html += '<span class="dashboard-stat-label">Slots used</span>';
    html += '<span class="dashboard-stat-value">' + used + ' / ' + total + '</span>';
    html += '</div>';

    html += '<div class="dashboard-garage-slots">';
    slots.forEach(function (slot, idx) {
      var isEmpty = !slot || !slot.vehicle;
      var label = isEmpty ? '_Empty_' : String(slot.vehicle);
      var metaParts = [];
      if (!isEmpty) {
        if (slot.purchase_price != null) metaParts.push('$' + fmt(slot.purchase_price));
        if (slot.rarity) metaParts.push(String(slot.rarity));
        if (slot.vehicle_type) metaParts.push(String(slot.vehicle_type));
      }
      var meta = metaParts.length ? ' — ' + metaParts.join(' • ') : '';
      html += '<div class="dashboard-garage-slot" data-slot-index="' + idx + '">';
      html += '<div class="dashboard-garage-slot-main">';
      html += '<span class="dashboard-garage-slot-label">Slot ' + (idx + 1) + '</span>';
      html += '<span class="dashboard-garage-slot-value">' + (isEmpty ? '_Empty_' : label + meta) + '</span>';
      html += '</div>';
      html += '<div class="dashboard-garage-slot-actions">';
      html += '<button type="button" class="dashboard-garage-btn" data-garage-move="up" data-slot-index="' + idx + '">▲</button>';
      html += '<button type="button" class="dashboard-garage-btn" data-garage-move="down" data-slot-index="' + idx + '">▼</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function scheduleGarageSave() {
    if (garageSaveTimer) clearTimeout(garageSaveTimer);
    garageSaveTimer = setTimeout(function () {
      garageSaveTimer = null;
      saveGarageState();
    }, 500);
  }

  function saveGarageState() {
    if (!garageState || !garageState.garages || !garageState.garages.length) return;
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var base = getStatsApiBase();
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!base || !token) return;

    var url = base + '/api/dashboard/garage';
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      mode: 'cors',
      body: JSON.stringify({ garages: garageState.garages })
    }).then(function (r) {
      if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/dashboard/garage POST', r.status, r.statusText);
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || 'Garage save failed');
        if (d && d.garages) {
          garageState = d;
          renderGaragePanel(garageState);
        }
      });
    }).catch(function (err) {
      console.warn('[GTA Dashboard] Garage save failed:', err && err.message);
      var errorEl = document.getElementById('dashboard-garage-error');
      if (!errorEl) {
        var container = document.getElementById('dashboard-garage-panel');
        if (container) {
          errorEl = document.createElement('p');
          errorEl.id = 'dashboard-garage-error';
          errorEl.className = 'dashboard-stats-error';
          container.insertBefore(errorEl, container.firstChild);
        }
      }
      if (errorEl) {
        errorEl.textContent = (err && err.message) || 'Could not save garage order. Try again.';
        errorEl.style.display = 'block';
      }
    });
  }

  function fetchGarageState() {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var base = getStatsApiBase();
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!base || !token) return;
    var url = base + '/api/dashboard/garage';
    var loading = document.getElementById('dashboard-garage-loading');
    if (loading) loading.style.display = 'block';
    fetch(url, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
      mode: 'cors'
    }).then(function (r) {
      if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/dashboard/garage GET', r.status, r.statusText);
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          throw new Error((d && d.error) || 'Garage fetch failed');
        });
      }
      return r.json();
    }).then(function (data) {
      garageState = data || { garages: [], meta: { total_slots: 0, used_slots: 0 } };
      renderGaragePanel(garageState);
    }).catch(function (err) {
      console.warn('[GTA Dashboard] Garage fetch failed:', err && err.message);
      var container = document.getElementById('dashboard-garage-panel');
      if (container) {
        container.innerHTML = '<p class="dashboard-stats-error">Could not load garage layout. Add ?debug=1 and check console.</p>';
      }
    });
  }

  function fetchAuthedJson(path, method, body) {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var base = getStatsApiBase();
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!base) return Promise.reject(new Error('Missing API URL. Set __GTA_API_URL__ in config.js.'));
    if (!token) return Promise.reject(new Error('Not logged in'));
    return fetch(base + path, {
      method: method || 'GET',
      headers: Object.assign(
        { 'Authorization': 'Bearer ' + token },
        body ? { 'Content-Type': 'application/json' } : {}
      ),
      mode: 'cors',
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || ('Request failed (' + r.status + ')'));
        return d;
      });
    });
  }

  function isClubOfficer(rankKey) {
    return CLUB_OFFICERS.indexOf(String(rankKey || '')) !== -1;
  }

  function canInviteForClub(rankKey) {
    return CLUB_INVITE_RANKS.indexOf(String(rankKey || '')) !== -1;
  }

  function canManageRanks(rankKey) {
    return CLUB_RANK_MANAGERS.indexOf(String(rankKey || '')) !== -1;
  }

  function renderClubManagement(state) {
    var container = document.getElementById('dashboard-club-management');
    if (!container) return;
    var home = state && state.home ? state.home : null;
    var invites = state && state.invites ? state.invites : { incoming: [], outgoing: [] };
    if (!home || !home.club_id) {
      var incomingHtml = '';
      if (invites.incoming && invites.incoming.length) {
        incomingHtml += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Incoming Invites</div>';
        invites.incoming.forEach(function (invite) {
          incomingHtml += '<div class="dashboard-list-item">';
          incomingHtml += '<div><strong>' + escapeHtml(invite.club_name || 'Club') + '</strong> [' + escapeHtml(invite.club_tag || '') + ']<br><span class="dashboard-muted">' + escapeHtml(invite.message || 'No message') + '</span></div>';
          incomingHtml += '<div class="dashboard-inline-actions">';
          incomingHtml += '<button type="button" class="dashboard-action-btn" data-club-invite-response="accept" data-invite-id="' + escapeHtml(invite.invite_id) + '">Accept</button>';
          incomingHtml += '<button type="button" class="dashboard-action-btn dashboard-action-btn--secondary" data-club-invite-response="decline" data-invite-id="' + escapeHtml(invite.invite_id) + '">Decline</button>';
          incomingHtml += '</div></div>';
        });
        incomingHtml += '</div>';
      }
      container.innerHTML = '<p class="dashboard-loading">You are not currently in an MC club.</p>' + incomingHtml;
      return;
    }

    var isOfficer = isClubOfficer(home.rank_key);
    var html = '';
    html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">Club</span><span class="dashboard-stat-value">' + escapeHtml(home.club_name || 'Unnamed Club') + (home.club_tag ? ' [' + escapeHtml(home.club_tag) + ']' : '') + '</span></div>';
    html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">Your Rank</span><span class="dashboard-stat-value">' + escapeHtml(fmtClubRank(home.rank_key)) + '</span></div>';
    html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">Members</span><span class="dashboard-stat-value">' + escapeHtml(String(home.member_count || 0)) + '</span></div>';

    if (isOfficer) {
      var identity = state.identity || {};
      html += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Club Identity</div>';
      html += '<form id="dashboard-club-identity-form" class="dashboard-form-grid">';
      html += '<input class="dashboard-input" name="name" placeholder="Club name" value="' + escapeHtml(identity.name || home.club_name || '') + '">';
      html += '<input class="dashboard-input" name="tag" placeholder="Tag" value="' + escapeHtml(identity.tag || home.club_tag || '') + '">';
      html += '<input class="dashboard-input" name="motto" placeholder="Motto" value="' + escapeHtml(identity.motto || '') + '">';
      html += '<textarea class="dashboard-input dashboard-textarea" name="bio" placeholder="Bio">' + escapeHtml(identity.bio || '') + '</textarea>';
      html += '<select class="dashboard-input" name="join_policy"><option value="open">Open</option><option value="application">Application</option><option value="invite_only">Invite Only</option></select>';
      html += '<label class="dashboard-check"><input type="checkbox" name="is_public"' + ((identity.is_public === true) ? ' checked' : '') + '> Public</label>';
      html += '<label class="dashboard-check"><input type="checkbox" name="recruitment_open"' + ((identity.recruitment_open === true) ? ' checked' : '') + '> Recruiting</label>';
      html += '<button type="submit" class="dashboard-action-btn">Save Identity</button>';
      html += '</form></div>';
    }

    html += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Members</div>';
    if (state.members && state.members.length) {
      state.members.forEach(function (member) {
        html += '<div class="dashboard-list-item">';
        html += '<div><strong>' + escapeHtml(member.username || member.user_id) + '</strong><br><span class="dashboard-muted">' + escapeHtml(fmtClubRank(member.rank_key)) + ' • Joined ' + fmtDate(member.joined_at) + '</span></div>';
        html += '<div class="dashboard-inline-actions">';
        if (canManageRanks(home.rank_key) && member.user_id !== state.viewerUserId) {
          html += '<select class="dashboard-input dashboard-input--compact" data-member-rank-select="' + escapeHtml(member.user_id) + '">';
          CLUB_RANKS.forEach(function (rank) {
            html += '<option value="' + escapeHtml(rank) + '"' + (rank === member.rank_key ? ' selected' : '') + '>' + escapeHtml(fmtClubRank(rank)) + '</option>';
          });
          html += '</select>';
          html += '<button type="button" class="dashboard-action-btn" data-club-rank-save="' + escapeHtml(member.user_id) + '">Save</button>';
        }
        if (isOfficer && member.user_id !== state.viewerUserId) {
          html += '<button type="button" class="dashboard-action-btn dashboard-action-btn--danger" data-club-remove-member="' + escapeHtml(member.user_id) + '">Remove</button>';
        }
        html += '</div></div>';
      });
    } else {
      html += '<p class="dashboard-loading">No members found.</p>';
    }
    html += '</div>';

    if (canInviteForClub(home.rank_key)) {
      html += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Recruitment</div>';
      html += '<form id="dashboard-club-invite-form" class="dashboard-form-grid">';
      html += '<input class="dashboard-input" name="target_user_id" placeholder="Discord user ID">';
      html += '<input class="dashboard-input" name="message" placeholder="Invite message">';
      html += '<button type="submit" class="dashboard-action-btn">Send Invite</button>';
      html += '</form>';
      if (state.applications && state.applications.length) {
        state.applications.forEach(function (app) {
          html += '<div class="dashboard-list-item"><div><strong>' + escapeHtml(app.username || app.user_id) + '</strong><br><span class="dashboard-muted">' + escapeHtml(app.message || 'No message') + '</span></div><div class="dashboard-inline-actions">';
          html += '<button type="button" class="dashboard-action-btn" data-club-review-application="accept" data-application-id="' + escapeHtml(app.application_id) + '">Accept</button>';
          html += '<button type="button" class="dashboard-action-btn dashboard-action-btn--secondary" data-club-review-application="reject" data-application-id="' + escapeHtml(app.application_id) + '">Reject</button>';
          html += '</div></div>';
        });
      }
      if (invites.outgoing && invites.outgoing.length) {
        html += '<div class="dashboard-subsection-title">Pending Invites</div>';
        invites.outgoing.forEach(function (invite) {
          html += '<div class="dashboard-list-item"><div><strong>' + escapeHtml(invite.invited_username || invite.invited_user_id) + '</strong><br><span class="dashboard-muted">Expires ' + fmtDate(invite.expires_at) + '</span></div></div>';
        });
      }
      html += '</div>';
    }

    html += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Treasury Log</div>';
    if (state.treasury && state.treasury.entries && state.treasury.entries.length) {
      state.treasury.entries.forEach(function (entry) {
        html += '<div class="dashboard-list-item"><div><strong>' + escapeHtml(entry.entry_type || 'entry') + '</strong><br><span class="dashboard-muted">' + escapeHtml(entry.description || '') + '</span></div><div class="dashboard-inline-value">$' + escapeHtml(fmt(entry.amount || 0)) + '</div></div>';
      });
    } else {
      html += '<p class="dashboard-loading">No treasury activity yet.</p>';
    }
    html += '</div>';

    if (invites.incoming && invites.incoming.length) {
      html += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Incoming Invites</div>';
      invites.incoming.forEach(function (invite) {
        html += '<div class="dashboard-list-item"><div><strong>' + escapeHtml(invite.club_name || 'Club') + '</strong> [' + escapeHtml(invite.club_tag || '') + ']</div><div class="dashboard-inline-actions">';
        html += '<button type="button" class="dashboard-action-btn" data-club-invite-response="accept" data-invite-id="' + escapeHtml(invite.invite_id) + '">Accept</button>';
        html += '<button type="button" class="dashboard-action-btn dashboard-action-btn--secondary" data-club-invite-response="decline" data-invite-id="' + escapeHtml(invite.invite_id) + '">Decline</button>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    if (isOfficer) {
      var joinPolicySelect = container.querySelector('select[name="join_policy"]');
      if (joinPolicySelect) joinPolicySelect.value = identity.join_policy || 'application';
    }
  }

  function fetchClubState() {
    return fetchAuthedJson('/api/club/home', 'GET').then(function (homeRes) {
      return fetchAuthedJson('/api/club/invites', 'GET').then(function (inviteRes) {
        var state = {
          home: homeRes && homeRes.club_home ? homeRes.club_home : null,
          invites: inviteRes || { incoming: [], outgoing: [] },
          members: [],
          applications: [],
          treasury: { entries: [] },
          identity: null,
          viewerUserId: (getStoredUser() || {}).id || ''
        };
        if (!state.home || !state.home.club_id) {
          clubState = state;
          renderClubManagement(clubState);
          return state;
        }
        return Promise.all([
          fetchAuthedJson('/api/club/members', 'GET'),
          fetchAuthedJson('/api/club/applications', 'GET'),
          fetchAuthedJson('/api/club/treasury/log', 'GET')
        ]).then(function (parts) {
          state.members = (parts[0] && parts[0].members) || [];
          state.applications = (parts[1] && parts[1].applications) || [];
          state.treasury = parts[2] || { entries: [] };
          state.identity = {
            name: state.home.club_name,
            tag: state.home.club_tag,
            motto: state.home.motto || '',
            bio: state.home.bio || '',
            is_public: !!state.home.is_public,
            recruitment_open: !!state.home.recruitment_open,
            join_policy: state.home.join_policy || 'application'
          };
          clubState = state;
          renderClubManagement(clubState);
          return state;
        });
      });
    }).catch(function (err) {
      console.warn('[GTA Dashboard] Club fetch failed:', err && err.message);
      var container = document.getElementById('dashboard-club-management');
      if (container) {
        container.innerHTML = '<p class="dashboard-stats-error">' + escapeHtml((err && err.message) || 'Could not load club data.') + '</p>';
      }
    });
  }

  function renderServerManagement(state) {
    var container = document.getElementById('dashboard-server-management');
    if (!container) return;
    if (!state || !state.servers || !state.servers.length) {
      container.innerHTML = '<p class="dashboard-loading">No manageable servers detected yet.</p>';
      return;
    }
    var html = '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Servers</div>';
    html += '<select class="dashboard-input" id="dashboard-server-select">';
    state.servers.forEach(function (server) {
      html += '<option value="' + escapeHtml(server.guild_id) + '">' + escapeHtml(server.name || server.guild_id) + '</option>';
    });
    html += '</select></div>';
    if (state.config) {
      html += '<div class="dashboard-subsection"><div class="dashboard-subsection-title">Leveling</div>';
      html += '<form id="dashboard-server-config-form" class="dashboard-form-grid">';
      html += '<input class="dashboard-input" name="leveling_channel_id" placeholder="Leveling channel ID" value="' + escapeHtml(state.config.leveling && state.config.leveling.leveling_channel_id ? state.config.leveling.leveling_channel_id : '') + '">';
      var available = (state.config.logging && state.config.logging.available_categories) || [];
      available.forEach(function (key) {
        var current = state.config.logging && state.config.logging.categories ? state.config.logging.categories[key] : '';
        html += '<input class="dashboard-input" name="logging_' + escapeHtml(key) + '" placeholder="' + escapeHtml(key) + ' channel ID" value="' + escapeHtml(current || '') + '">';
      });
      html += '<button type="submit" class="dashboard-action-btn">Save Server Config</button>';
      html += '</form></div>';
    }
    container.innerHTML = html;
    var select = document.getElementById('dashboard-server-select');
    if (select && state.selectedGuildId) select.value = state.selectedGuildId;
  }

  function fetchServerState(selectedGuildId) {
    return fetchAuthedJson('/api/admin/servers', 'GET').then(function (res) {
      var state = { servers: (res && res.servers) || [], selectedGuildId: selectedGuildId || null, config: null };
      if (!state.servers.length) {
        serverState = state;
        renderServerManagement(serverState);
        return state;
      }
      state.selectedGuildId = state.selectedGuildId || state.servers[0].guild_id;
      return fetchAuthedJson('/api/admin/server/' + encodeURIComponent(state.selectedGuildId) + '/config', 'GET').then(function (cfg) {
        state.config = cfg || {};
        serverState = state;
        renderServerManagement(serverState);
        return state;
      });
    }).catch(function (err) {
      console.warn('[GTA Dashboard] Server management fetch failed:', err && err.message);
      var container = document.getElementById('dashboard-server-management');
      if (container) {
        container.innerHTML = '<p class="dashboard-stats-error">' + escapeHtml((err && err.message) || 'Could not load server management data.') + '</p>';
      }
    });
  }

  function fetchUserStats() {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var base = getStatsApiBase();
    var token = auth && auth.getToken ? auth.getToken() : '';
    if (!base) return Promise.reject(new Error('Missing API URL. Set __GTA_API_URL__ in config.js.'));
    if (!token) return Promise.reject(new Error('Not logged in'));

    var url = base + '/api/stats/user';
    return fetch(url, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
      mode: 'cors'
    }).then(function (r) {
      if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/stats/user response', r.status, r.statusText);
      if (!r.ok) {
        var msg = r.status === 401 ? 'Session expired. Please log in again.' : 'Stats fetch failed (' + r.status + ')';
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (window.__GTA_DEBUG__) console.warn('[GTA Dashboard] /api/stats/user error body', d);
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
    return auth.fetchMe().then(function (me) {
      if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/auth/me OK', me && me.id ? 'user ' + me.id : 'no id');
      if (!me || !me.id) return showGuestView();
      return fetchUserStats().then(function (stats) {
        if (window.__GTA_DEBUG__) console.log('[GTA Dashboard] /api/stats/user OK', stats && (stats.cash !== undefined) ? 'has stats' : 'no stats');
        showDashboardStatsError(false);
        var merged = Object.assign({}, me, stats);
        merged.stats_fetched_at = Date.now();
        setStoredUser(merged);
        showUserView(merged);
        fetchGarageState();
        fetchClubState();
        fetchServerState();
        showNoGameDataHint(!!(stats && stats.no_game_data_yet), (stats && stats.no_game_data_yet) ? 'You\'re signed in, but you don\'t have game data yet. Use the bot in Discord (run /start in a server with the bot) to create your character; your stats will then appear here.' : undefined);
      }).catch(function (err) {
        console.warn('[GTA Dashboard] Stats fetch failed:', err && err.message);
        var cached = getStoredUser();
        var displayData = (cached && cached.id === me.id && hasCachedStats(cached))
          ? Object.assign({}, cached, me)
          : me;
        setStoredUser(displayData);
        showUserView(displayData);
        var errMsg = (err && err.message) || 'Couldn\'t load your stats. Add ?debug=1 to URL and open console (F12) for details.';
        showDashboardStatsError(true, errMsg);
        showNoGameDataHint(true, errMsg + ' If you have game data in Discord, check Vercel env: AUTH_JWT_SECRET and DATABASE_URL (same Neon DB as the bot).');
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

    // Load from API only if cache is missing/stale; manual button handles user-triggered refresh.
    if (!cached || !isStatsCacheFresh(cached)) {
      refreshDashboardStats();
    }
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

    var garagePanel = document.getElementById('dashboard-garage-panel');
    if (garagePanel) {
      garagePanel.addEventListener('click', function (ev) {
        var target = ev.target;
        if (!target || !target.getAttribute) return;
        var dir = target.getAttribute('data-garage-move');
        if (!dir) return;
        var idxStr = target.getAttribute('data-slot-index');
        var idx = parseInt(idxStr, 10);
        if (!garageState || !garageState.garages || !garageState.garages.length) return;
        var g = garageState.garages[0];
        var slots = Array.isArray(g.slots) ? g.slots : [];
        if (isNaN(idx) || idx < 0 || idx >= slots.length) return;
        var swapWith = dir === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= slots.length) return;
        var tmp = slots[idx];
        slots[idx] = slots[swapWith];
        slots[swapWith] = tmp;
        g.slots = slots;
        renderGaragePanel(garageState);
        scheduleGarageSave();
      });
    }

    var clubPanel = document.getElementById('dashboard-club-management');
    if (clubPanel) {
      clubPanel.addEventListener('submit', function (ev) {
        var form = ev.target;
        if (!form || !form.id) return;
        ev.preventDefault();
        if (form.id === 'dashboard-club-identity-form') {
          var fd = new FormData(form);
          fetchAuthedJson('/api/club/identity', 'POST', {
            name: fd.get('name'),
            tag: fd.get('tag'),
            motto: fd.get('motto'),
            bio: fd.get('bio'),
            join_policy: fd.get('join_policy'),
            is_public: !!fd.get('is_public'),
            recruitment_open: !!fd.get('recruitment_open')
          }).then(function () {
            refreshDashboardStats();
          }).catch(function (err) {
            alert((err && err.message) || 'Failed to save club identity.');
          });
        }
        if (form.id === 'dashboard-club-invite-form') {
          var inviteFd = new FormData(form);
          fetchAuthedJson('/api/club/invites/create', 'POST', {
            target_user_id: inviteFd.get('target_user_id'),
            message: inviteFd.get('message')
          }).then(function () {
            fetchClubState();
            form.reset();
          }).catch(function (err) {
            alert((err && err.message) || 'Failed to send invite.');
          });
        }
      });

      clubPanel.addEventListener('click', function (ev) {
        var target = ev.target;
        if (!target || !target.getAttribute) return;
        var inviteAction = target.getAttribute('data-club-invite-response');
        var inviteId = target.getAttribute('data-invite-id');
        if (inviteAction && inviteId) {
          fetchAuthedJson('/api/club/invites/respond', 'POST', { invite_id: inviteId, accept: inviteAction === 'accept' }).then(function () {
            refreshDashboardStats();
          }).catch(function (err) {
            alert((err && err.message) || 'Failed to respond to invite.');
          });
          return;
        }
        var applicationAction = target.getAttribute('data-club-review-application');
        var applicationId = target.getAttribute('data-application-id');
        if (applicationAction && applicationId) {
          fetchAuthedJson('/api/club/applications/review', 'POST', { application_id: applicationId, accept: applicationAction === 'accept' }).then(function () {
            fetchClubState();
          }).catch(function (err) {
            alert((err && err.message) || 'Failed to review application.');
          });
          return;
        }
        var saveUserId = target.getAttribute('data-club-rank-save');
        if (saveUserId) {
          var select = clubPanel.querySelector('[data-member-rank-select="' + saveUserId + '"]');
          fetchAuthedJson('/api/club/members/change-rank', 'POST', {
            target_user_id: saveUserId,
            new_rank_key: select ? select.value : ''
          }).then(function () {
            refreshDashboardStats();
          }).catch(function (err) {
            alert((err && err.message) || 'Failed to update rank.');
          });
          return;
        }
        var removeUserId = target.getAttribute('data-club-remove-member');
        if (removeUserId) {
          fetchAuthedJson('/api/club/members/remove', 'POST', {
            target_user_id: removeUserId,
            leave_reason: 'removed',
            add_to_blacklist: false
          }).then(function () {
            refreshDashboardStats();
          }).catch(function (err) {
            alert((err && err.message) || 'Failed to remove member.');
          });
        }
      });
    }

    var serverPanel = document.getElementById('dashboard-server-management');
    if (serverPanel) {
      serverPanel.addEventListener('change', function (ev) {
        var target = ev.target;
        if (target && target.id === 'dashboard-server-select') {
          fetchServerState(target.value);
        }
      });
      serverPanel.addEventListener('submit', function (ev) {
        var form = ev.target;
        if (!form || form.id !== 'dashboard-server-config-form' || !serverState || !serverState.selectedGuildId) return;
        ev.preventDefault();
        var fd = new FormData(form);
        var loggingChannels = {};
        var available = (serverState.config && serverState.config.logging && serverState.config.logging.available_categories) || [];
        available.forEach(function (key) {
          loggingChannels[key] = fd.get('logging_' + key) || null;
        });
        fetchAuthedJson('/api/admin/server/' + encodeURIComponent(serverState.selectedGuildId) + '/config', 'POST', {
          leveling_channel_id: fd.get('leveling_channel_id') || null,
          logging_channels: loggingChannels
        }).then(function () {
          fetchServerState(serverState.selectedGuildId);
        }).catch(function (err) {
          alert((err && err.message) || 'Failed to save server config.');
        });
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
