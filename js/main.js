(function () {
  'use strict';

  var PAGE_ORDER = ['home', 'commands', 'stats', 'login', 'dashboard', 'help', 'support', 'setup'];
  var pages = document.querySelectorAll('.page');
  var navLinks = document.querySelectorAll('.nav-link, .nav-brand[data-page]');
  var pageContainer = document.querySelector('.app-pages');
  var pagesInner = document.getElementById('app-pages-inner');
  var currentIndex = 0;
  var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function indexOfPage(pageId) {
    var i = PAGE_ORDER.indexOf(pageId);
    return i >= 0 ? i : 0;
  }

  function setStripPosition(index) {
    if (!pagesInner) return;
    currentIndex = index;
    var pct = 100 / Math.max(1, PAGE_ORDER.length);
    var tx = -index * pct;
    pagesInner.style.transform = 'translateX(' + tx + '%)';
  }

  function showPage(pageId) {
    if (!pageId) return;
    pageId = resolvePageForAuth ? resolvePageForAuth(pageId) : pageId;
    var target = document.getElementById('page-' + pageId);
    if (!target) return;

    var nextIndex = indexOfPage(pageId);
    setStripPosition(nextIndex);

    pages.forEach(function (p) {
      p.classList.toggle('is-active', p === target);
    });

    navLinks.forEach(function (link) {
      var linkPage = link.getAttribute('data-page');
      link.classList.toggle('active', linkPage === pageId);
    });

    var scrollEl = target.querySelector('.page-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;

    target.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  function goPrev() {
    if (currentIndex <= 0) return;
    showPage(PAGE_ORDER[currentIndex - 1]);
  }

  function goNext() {
    if (currentIndex >= PAGE_ORDER.length - 1) return;
    showPage(PAGE_ORDER[currentIndex + 1]);
  }

  function updateNavAuthState(loggedIn) {
    var guestItems = document.querySelectorAll('.nav-item--auth-guest');
    var userItems = document.querySelectorAll('.nav-item--auth-user');
    guestItems.forEach(function (li) {
      li.style.display = loggedIn ? 'none' : '';
    });
    userItems.forEach(function (li) {
      li.style.display = loggedIn ? 'list-item' : 'none';
    });
  }

  function resolvePageForAuth(pageId) {
    var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
    var loggedIn = auth && auth.isLoggedIn ? auth.isLoggedIn() : false;
    if (pageId === 'dashboard' && !loggedIn) return 'login';
    if (pageId === 'login' && loggedIn) return 'dashboard';
    return pageId;
  }

  document.addEventListener('click', function (e) {
    // Don't intercept login OAuth button - let it navigate to /api/auth/discord/start
    if (e.target.closest('#login-discord-btn')) return;
    var el = e.target.closest('[data-page]');
    if (!el) return;
    var pageId = el.getAttribute('data-page');
    if (!pageId || !document.getElementById('page-' + pageId)) return;
    e.preventDefault();
    pageId = resolvePageForAuth(pageId);
    if (!document.getElementById('page-' + pageId)) return;
    showPage(pageId);
    var navLinksEl = document.querySelector('.nav-links');
    if (navLinksEl && navLinksEl.classList.contains('is-open')) {
      navLinksEl.classList.remove('is-open');
    }
  });

  var touchStartX = 0;
  var touchEndX = 0;
  if (pageContainer) {
    pageContainer.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches ? e.changedTouches[0].screenX : e.screenX;
    }, { passive: true });
    pageContainer.addEventListener('touchend', function (e) {
      touchEndX = e.changedTouches ? e.changedTouches[0].screenX : e.screenX;
      var diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) goNext();
        else goPrev();
      }
    }, { passive: true });
  }

  var initialHash = (window.location.hash || '').replace('#', '');
  var resolvedHash = resolvePageForAuth ? resolvePageForAuth(initialHash) : initialHash;
  if (resolvedHash && document.getElementById('page-' + resolvedHash)) {
    currentIndex = indexOfPage(resolvedHash);
    setStripPosition(currentIndex);
    showPage(resolvedHash);
  } else {
    setStripPosition(0);
    showPage('home');
  }

  // Auth-aware nav: show Dashboard when logged in, show Login when logged out
  var auth = typeof window.GTA_AUTH !== 'undefined' ? window.GTA_AUTH : null;
  if (auth && auth.onAuthStateChange && auth.isLoggedIn) {
    auth.onAuthStateChange(updateNavAuthState);
    var initialLoggedIn = auth.isLoggedIn();
    if (window.__GTA_DEBUG__) console.log('[GTA Nav] Initial isLoggedIn:', initialLoggedIn);
    updateNavAuthState(initialLoggedIn);
    // Refresh again after load (session may be in URL and consumed by auth.js)
    window.addEventListener('load', function () {
      var afterLoad = auth.isLoggedIn();
      if (window.__GTA_DEBUG__) console.log('[GTA Nav] After load isLoggedIn:', afterLoad);
      updateNavAuthState(afterLoad);
    });
  }

  // ---------- Parallax (scroll-based; scoped to active page) ----------
  var ticking = false;

  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function getScrollTop() {
    var activePage = document.querySelector('.page.is-active');
    if (!activePage) return 0;
    if (activePage.id === 'page-home') return window.pageYOffset || document.documentElement.scrollTop;
    var scrollEl = activePage.querySelector('.page-scroll');
    if (scrollEl) return scrollEl.scrollTop;
    return window.pageYOffset || document.documentElement.scrollTop;
  }

  function getParallaxRoot() {
    var activePage = document.querySelector('.page.is-active');
    return activePage || document.body;
  }

  function updateParallax() {
    var scrollY = getScrollTop();
    var root = getParallaxRoot();
    var layers = root.querySelectorAll('[data-parallax-speed]');

    if (prefersReducedMotion) {
      layers.forEach(function (el) {
        el.style.transform = 'translate3d(0, 0px, 0)';
      });
    } else {
      layers.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.2;
        var y = scrollY * speed;
        el.style.transform = 'translate3d(0, ' + y + 'px, 0)';
      });
    }

    // Cinematic hero day -> night (Home only; scroll-driven)
    var hero = root.querySelector('#hero');
    if (hero) {
      if (prefersReducedMotion) {
        hero.style.setProperty('--hero-night', '0');
      } else {
        var h = hero.offsetHeight || window.innerHeight || 1;
        var t = clamp01(scrollY / (h * 0.9));
        hero.style.setProperty('--hero-night', t.toFixed(4));
      }
    }

    ticking = false;
  }

  function requestParallaxTick() {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  function attachParallaxListeners() {
    pages.forEach(function (page) {
      var scrollEl = page.querySelector('.page-scroll');
      if (scrollEl) {
        scrollEl.removeEventListener('scroll', requestParallaxTick);
        scrollEl.addEventListener('scroll', requestParallaxTick, { passive: true });
      }
    });
    window.removeEventListener('scroll', requestParallaxTick);
    window.addEventListener('scroll', requestParallaxTick, { passive: true });
  }

  attachParallaxListeners();
  updateParallax();

  // Re-run parallax when page changes
  var observer = new MutationObserver(function () {
    requestParallaxTick();
  });
  if (pageContainer) {
    observer.observe(pageContainer, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }

  // ---------- Accordions ----------
  var accordionItems = document.querySelectorAll('.accordion-item');
  accordionItems.forEach(function (item) {
    var trigger = item.querySelector('.accordion-trigger');
    var panel = item.querySelector('.accordion-panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', function () {
      var isOpen = item.classList.contains('is-open');
      accordionItems.forEach(function (other) {
        other.classList.remove('is-open');
      });
      if (!isOpen) {
        item.classList.add('is-open');
      }
    });
  });

  if (accordionItems.length) {
    accordionItems[0].classList.add('is-open');
  }

  // ---------- Scroll reveal (only for visible page) ----------
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, root: null });

    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // ---------- Mobile nav toggle ----------
  var navToggle = document.querySelector('.nav-toggle');
  var navLinksEl = document.querySelector('.nav-links');
  if (navToggle && navLinksEl) {
    navToggle.addEventListener('click', function () {
      navLinksEl.classList.toggle('is-open');
    });
  }
})();
