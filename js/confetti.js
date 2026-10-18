'use strict';

const Confetti = {
  colors: ['#ff4d6d', '#ffd84d', '#4dabf7', '#51cf66', '#c8f83c', '#b197fc', '#ff922b'],
  timer: null,
  /**
   * Запускает салют из конфетти на весь экран (не показывается при включённом «уменьшении движения»).
   * @param {Object} options Параметры: count — число частиц (необязательно).
   * @returns {number} сколько частиц запущено.
   */
  burst(options) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    const settings = Object.assign(
        {
          count: 70
        },
        options
      ),
      count = Math.min(Math.max(1, settings.count), 140);
    let root = document.getElementById('confetti');
    if (!root) {
      root = document.createElement('div');
      root.id = 'confetti';
      root.setAttribute('aria-hidden', 'true');
      document.body.appendChild(root);
    }
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece' + (i % 3 === 0 ? ' round' : i % 3 === 1 ? ' strip' : '');
      piece.style.setProperty('--x', (Math.random() * 100).toFixed(1));
      piece.style.setProperty('--dx', (Math.random() * 30 - 15).toFixed(1) + 'vw');
      piece.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      piece.style.setProperty('--d', (2.4 + Math.random() * 2).toFixed(2) + 's');
      piece.style.setProperty('--delay', (Math.random() * 0.6).toFixed(2) + 's');
      piece.style.background = Confetti.colors[i % Confetti.colors.length];
      root.appendChild(piece);
    }
    clearTimeout(Confetti.timer);
    Confetti.timer = setTimeout(() => root.remove(), 5600);
    return count;
  }
};
