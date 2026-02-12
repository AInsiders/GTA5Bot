(function () {
  'use strict';

  // ---------- Page switching (single-page app) ----------
  var pages = document.querySelectorAll('.page');
  var navLinks = document.querySelectorAll('.nav-link, .nav-brand[data-page]');
  var pageContainer = document.querySelector('.app-pages');

  function showPage(pageId) {
    if (!pageId) return;
    var target = document.getElementById('page-' + pageId);
    if (!target) return;

    pages.forEach(function (p) {
      p.classList.remove('is-active');
    });
    target.classList.add('is-active');

    navLinks.forEach(function (link) {
      var linkPage = link.getAttribute('data-page');
      link.classList.toggle('active', linkPage === pageId);
    });

    // Reset scroll of the activated page's scroll area (optional: keep scroll per page)
    var scrollEl = target.querySelector('.page-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;

    // Reveal triggers for the new page
    target.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var pageId = link.getAttribute('data-page');
      if (!pageId) return;
      e.preventDefault();
      showPage(pageId);
      var navLinksEl = document.querySelector('.nav-links');
      if (navLinksEl && navLinksEl.classList.contains('is-open')) {
        navLinksEl.classList.remove('is-open');
      }
    });
  });

  // Optional: hash on load
  var initialHash = (window.location.hash || '').replace('#', '');
  if (initialHash && document.getElementById('page-' + initialHash)) {
    showPage(initialHash);
  } else {
    showPage('home');
  }

  // ---------- Parallax (scroll-based; scoped to active page) ----------
  var ticking = false;

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
    layers.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.2;
      var y = scrollY * speed;
      el.style.transform = 'translate3d(0, ' + y + 'px, 0)';
    });
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
