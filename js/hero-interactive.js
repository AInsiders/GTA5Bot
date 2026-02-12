(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var glow = document.getElementById('hero-mouse-glow');
  if (!hero || !glow) return;

  function setGlow(x, y) {
    glow.style.setProperty('--hero-mouse-x', x + '%');
    glow.style.setProperty('--hero-mouse-y', y + '%');
  }

  function onMove(e) {
    var rect = hero.getBoundingClientRect();
    var x = ((e.clientX - rect.left) / rect.width) * 100;
    var y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlow(x, y);
  }

  function onLeave() {
    setGlow(50, 50);
  }

  hero.addEventListener('mousemove', onMove, { passive: true });
  hero.addEventListener('mouseleave', onLeave);
  setGlow(50, 50);
})();
