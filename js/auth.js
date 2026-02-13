/**
 * Discord OAuth session handling for GTA Bot website.
 * - Sets the "Connect with Discord" button URL
 * - Accepts `?session=<jwt>` from the Vercel auth callback and stores it
 */
(function () {
  'use strict';

  var TOKEN_KEY = 'gta_auth_token';

  function getApiBase() {
    var raw = (typeof window !== 'undefined' && (window.__GTA_API_URL__ || window.__NEON_STATS_API_URL__))
      ? String(window.__GTA_API_URL__ || window.__NEON_STATS_API_URL__) : '';
    return raw.replace(/\/$/, '');
  }

  function setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      notifyAuthChange(true);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    notifyAuthChange(false);
  }

  function isLoggedIn() {
    return !!(getToken() || '').trim();
  }

  var authChangeListeners = [];
  function onAuthStateChange(fn) {
    if (typeof fn === 'function') authChangeListeners.push(fn);
  }
  function notifyAuthChange(loggedIn) {
    authChangeListeners.forEach(function (fn) { fn(loggedIn); });
  }

  function consumeSessionFromUrl() {
    try {
      var url = new URL(window.location.href);
      var session = url.searchParams.get('session');
      if (!session) return;

      setToken(session);
      url.searchParams.delete('session');
      window.history.replaceState({}, document.title, url.toString());
    } catch (e) {
      // ignore
    }
  }

  function wireLoginButton() {
    var btn = document.getElementById('login-discord-btn');
    if (!btn) return;
    var base = getApiBase();
    if (!base) {
      btn.setAttribute('href', '#');
      btn.setAttribute('aria-disabled', 'true');
      btn.title = 'Missing API base URL config';
      return;
    }
    btn.setAttribute('href', base + '/api/auth/discord/start');
  }

  function fetchMe() {
    var base = getApiBase();
    var token = getToken();
    if (!base || !token) return Promise.reject(new Error('Missing api base or token'));
    return fetch(base + '/api/auth/me', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function (r) {
      if (r.status === 401) {
        clearToken();
      }
      return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (d) {
        throw new Error((d && d.error) ? d.error : 'Auth failed');
      });
    });
  }

  // expose minimal helpers for dashboard.js and nav
  window.GTA_AUTH = {
    getApiBase: getApiBase,
    getToken: getToken,
    clearToken: clearToken,
    fetchMe: fetchMe,
    isLoggedIn: isLoggedIn,
    onAuthStateChange: onAuthStateChange
  };

  consumeSessionFromUrl();
  wireLoginButton();
})();

