(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var grid = document.getElementById('hero-grid');
  if (!hero || !grid) return;

  var mouseX = 0.5;
  var mouseY = 0.5;
  var targetX = 0.5;
  var targetY = 0.5;

  function setGridWarp(x, y) {
    targetX = x;
    targetY = y;
  }

  function animate() {
    mouseX += (targetX - mouseX) * 0.08;
    mouseY += (targetY - mouseY) * 0.08;
    var tiltX = (mouseY - 0.5) * -12;
    var tiltY = (mouseX - 0.5) * 12;
    grid.style.setProperty('--grid-tilt-x', tiltX + 'deg');
    grid.style.setProperty('--grid-tilt-y', tiltY + 'deg');
    requestAnimationFrame(animate);
  }

  function onMove(e) {
    var rect = hero.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width;
    var y = (e.clientY - rect.top) / rect.height;
    setGridWarp(Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
  }

  function onLeave() {
    setGridWarp(0.5, 0.5);
  }

  hero.addEventListener('mousemove', onMove, { passive: true });
  hero.addEventListener('mouseleave', onLeave);
  animate();
})();
