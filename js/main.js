(function () {
  'use strict';

  // ---------- Parallax (scroll-based layer movement) ----------
  var parallaxLayers = document.querySelectorAll('[data-parallax-speed]');
  var ticking = false;

  function updateParallax() {
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    parallaxLayers.forEach(function (el) {
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

  if (parallaxLayers.length) {
    window.addEventListener('scroll', requestParallaxTick, { passive: true });
    updateParallax();
  }

  // ---------- Smooth scroll for anchor links ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    var href = anchor.getAttribute('href');
    if (href === '#') return;
    var target = document.querySelector(href);
    if (!target) return;
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ---------- Accordions (single open by default) ----------
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

  // Optional: open first accordion on load
  if (accordionItems.length) {
    accordionItems[0].classList.add('is-open');
  }

  // ---------- Nav: highlight current section on scroll ----------
  var navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  var sections = [];
  navLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) sections.push({ id: id, el: section, link: link });
  });

  function updateNavActive() {
    var scrollY = window.pageYOffset;
    var viewportMid = scrollY + window.innerHeight * 0.4;
    var current = null;
    sections.forEach(function (s) {
      var top = s.el.offsetTop;
      var height = s.el.offsetHeight;
      if (viewportMid >= top && viewportMid < top + height) current = s;
    });
    sections.forEach(function (s) {
      s.link.classList.toggle('active', s === current);
    });
  }

  if (sections.length) {
    window.addEventListener('scroll', updateNavActive, { passive: true });
    updateNavActive();
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
